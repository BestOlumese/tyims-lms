"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Modal } from "@/components/shared/modal";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Video,
  FileText,
  Save,
  Loader2,
  FileIcon,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import MuxPlayer from "@mux/mux-player-react";
import type { QuizQuestion } from "./quiz-builder";
import { UploadArea } from "@/components/shared/upload-area";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/shared/skeletons";

const Editor = dynamic(() => import("@/components/shared/editor").then(mod => mod.Editor), { 
  ssr: false, 
  loading: () => <Skeleton className="w-full h-64" /> 
});
const QuizBuilder = dynamic(() => import("./quiz-builder").then(mod => mod.QuizBuilder), { 
  ssr: false, 
  loading: () => <Skeleton className="w-full h-96" /> 
});
import { cn } from "@/lib/utils";

interface ItemEditorModalProps {
  courseId: string;
  item: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ItemEditorModal = ({
  courseId,
  item,
  isOpen,
  onClose,
  onSuccess,
}: ItemEditorModalProps) => {
  const queryClient = useQueryClient();
  const queryKey = orpc.instructor.getChapters.queryOptions({ input: { courseId } }).queryKey;

  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || "");
  const [isFree, setIsFree] = useState(item.isFree || false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [currentItem, setCurrentItem] = useState(item);
  const [isSaving, setIsSaving] = useState(false);
  const [isQuizReady, setIsQuizReady] = useState(item.type !== "QUIZ" || !item.quizId);
  const [isQuizValid, setIsQuizValid] = useState(true);

  // Quiz state lifted from QuizBuilder
  const quizQuestionsRef = useRef<QuizQuestion[]>([]);

  useEffect(() => {
    setTitle(item.title);
    setDescription(item.description || "");
    setIsFree(item.isFree || false);
    setCurrentItem(item);
    setIsReplacing(false);
    setIsQuizReady(item.type !== "QUIZ" || !item.quizId);
    quizQuestionsRef.current = [];
  }, [item]);

  // Prefetch quiz data when modal opens for a QUIZ item
  useEffect(() => {
    if (isOpen && currentItem.type === "QUIZ" && currentItem.quizId) {
      console.log("Modal: Prefetching quiz data...", currentItem.quizId);
      queryClient.prefetchQuery(
        orpc.instructor.getQuestions.queryOptions({ input: { quizId: currentItem.quizId } })
      );
    }
  }, [isOpen, currentItem.type, currentItem.quizId, queryClient]);

  // --- VIDEO PROCESSING POLL ---
  useEffect(() => {
    if (!currentItem.muxAssetId || currentItem.muxPlaybackId || !isOpen) return;

    const interval = setInterval(async () => {
      try {
        const chapters = await queryClient.fetchQuery({
          ...orpc.instructor.getChapters.queryOptions({ input: { courseId } }),
          staleTime: 0,
        });

        for (const chapter of chapters as any[]) {
          const found = (chapter.lessons || []).find((l: any) => l.id === item.id);
          if (found && found.muxPlaybackId) {
            setCurrentItem(found);
            toast.success("Video is ready!");
            clearInterval(interval);
            break;
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentItem.muxAssetId, currentItem.muxPlaybackId, isOpen, item.id, courseId, queryClient]);

  const updateLessonMutation = useMutation({
    ...orpc.instructor.updateLesson.mutationOptions(),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const saveQuizMutation = useMutation(
    orpc.instructor.saveQuiz.mutationOptions()
  );

  // --- UNIFIED SAVE ---
  const onSave = async () => {
    if (!isQuizReady) {
        toast.error("Please wait for the quiz to finish loading.");
        return;
    }

    setIsSaving(true);
    try {
      // 1. Save lesson metadata
      await updateLessonMutation.mutateAsync({ id: currentItem.id, title, description, isFree });

      // 2. If quiz, save the questions from the ref
      if (currentItem.type === "QUIZ" && currentItem.quizId) {
        console.log("Modal: Saving quiz to server...", { 
            quizId: currentItem.quizId, 
            questions: quizQuestionsRef.current 
        });

        await saveQuizMutation.mutateAsync({
          quizId: currentItem.quizId,
          questions: quizQuestionsRef.current.map((q, idx) => ({
            question: q.question,
            type: q.type,
            orderIndex: idx,
            options: q.options.map((opt) => ({
              text: opt.text,
              isCorrect: opt.isCorrect,
            })),
          })),
        });

        // Await the refetch to guarantee the cache is fresh before modal closes
        await queryClient.refetchQueries({
          queryKey: orpc.instructor.getQuestions.queryOptions({ input: { quizId: currentItem.quizId } }).queryKey,
        });
      }

      toast.success("Changes saved!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Modal: Save error", error);
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadComplete = async (res: any) => {
    const file = res[0];
    try {
      if (item.type === "VIDEO") {
        const processingState = { ...currentItem, muxAssetId: "processing", muxPlaybackId: null };
        setCurrentItem(processingState);
        queryClient.setQueryData(queryKey, (old: any[] = []) =>
          old.map((c) => ({
            ...c,
            lessons: (c.lessons || []).map((l: any) =>
              l.id === item.id ? { ...l, muxAssetId: "processing", muxPlaybackId: null } : l,
            ),
          })),
        );
        toast.success("Video uploaded! Processing started…");
      } else if (item.type === "FILE") {
        await updateLessonMutation.mutateAsync({
          id: item.id,
          fileUrl: file.url,
          fileName: file.name,
          fileSize: file.size,
        });
        setCurrentItem((prev: any) => ({
          ...prev,
          fileUrl: file.url,
          fileName: file.name,
          fileSize: file.size,
        }));
        toast.success("File uploaded successfully");
      }
      setIsReplacing(false);
      onSuccess();
    } catch {
      toast.error("Failed to sync upload");
    }
  };

  const onInitQuiz = useCallback(() => {
    console.log("Modal: Quiz initialized and ready");
    setIsQuizReady(true);
  }, []);

  const onQuizChange = useCallback((questions: QuizQuestion[]) => {
    quizQuestionsRef.current = questions;
  }, []);

  const onQuizValidation = useCallback((isValid: boolean) => {
    setIsQuizValid(isValid);
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${item.type.toLowerCase()}: ${item.title}`}
    >
      <div className="space-y-8 pb-4">
        <div className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-gray-700 ml-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 focus:bg-white transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-gray-700 ml-1">Description (Optional)</label>
            <Editor value={description} onChange={setDescription} />
          </div>

          {/* Free Preview Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl">
            <div className="space-y-0.5">
              <label className="text-[13px] font-bold text-gray-900">Free Preview</label>
              <p className="text-[11px] text-gray-500">Allow students to view this {item.type.toLowerCase()} for free</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* VIDEO */}
          {item.type === "VIDEO" && (
            <div className="space-y-4">
              <label className="text-[13px] font-bold text-gray-700 ml-1 flex items-center gap-2">
                <Video size={16} className="text-indigo-600" />
                Video Content
              </label>

              {currentItem.muxPlaybackId && !isReplacing ? (
                <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-lg">
                  <MuxPlayer
                    playbackId={currentItem.muxPlaybackId}
                    metadata={{ video_id: item.id, video_title: item.title }}
                  />
                  <div className="p-4 bg-white flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1.5">
                      <CheckCircle2 size={14} />
                      Ready to play
                    </span>
                    <button
                      onClick={() => setIsReplacing(true)}
                      className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw size={11} /> Change Video
                    </button>
                  </div>
                </div>
              ) : currentItem.muxAssetId && !isReplacing ? (
                <div className="p-10 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-center space-y-4">
                  <Loader2 className="animate-spin text-indigo-600 mx-auto" size={32} />
                  <div>
                    <h4 className="text-[14px] font-bold text-gray-900">Video is processing</h4>
                    <p className="text-[12px] text-gray-500 font-medium mt-1">
                      The player will appear automatically when ready.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                    <span className="text-[11px] font-medium text-indigo-500">Checking every 3 seconds…</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {isReplacing && (
                    <button
                      onClick={() => setIsReplacing(false)}
                      className="text-[12px] font-bold text-gray-400 hover:text-gray-900 flex items-center gap-1"
                    >
                      <ArrowLeft size={14} /> Cancel replacement
                    </button>
                  )}
                  <UploadArea
                    endpoint="chapterVideo"
                    input={{ lessonId: item.id }}
                    onClientUploadComplete={handleUploadComplete}
                    onUploadError={(e) => toast.error(`Upload failed: ${e.message}`)}
                    accent="indigo"
                    icon={Video}
                    label="Upload your video"
                    sublabel="MP4, MOV, AVI — up to 512GB"
                  />
                </div>
              )}
            </div>
          )}

          {/* FILE */}
          {item.type === "FILE" && (
            <div className="space-y-4">
              <label className="text-[13px] font-bold text-gray-700 ml-1 flex items-center gap-2">
                <FileText size={16} className="text-emerald-600" />
                Downloadable File
              </label>

              {currentItem.fileUrl && !isReplacing ? (
                <div className="flex items-center gap-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  <div className="p-2.5 bg-white rounded-lg text-emerald-600">
                    <FileIcon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 truncate">{currentItem.fileName}</p>
                    <p className="text-[11px] text-emerald-600 font-medium">
                      {(currentItem.fileSize / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => setIsReplacing(true)}
                    className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw size={11} /> Replace
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {isReplacing && (
                    <button
                      onClick={() => setIsReplacing(false)}
                      className="text-[12px] font-bold text-gray-400 hover:text-gray-900 flex items-center gap-1"
                    >
                      <ArrowLeft size={14} /> Cancel replacement
                    </button>
                  )}
                  <UploadArea
                    endpoint="courseAttachment"
                    onClientUploadComplete={handleUploadComplete}
                    onUploadError={(e) => toast.error(`Upload failed: ${e.message}`)}
                    accent="emerald"
                    icon={FileText}
                    label="Upload a file"
                    sublabel="PDF, Image, Audio, Text"
                  />
                </div>
              )}
            </div>
          )}

          {/* QUIZ — inline, data flows up via callback */}
          {currentItem.type === "QUIZ" && currentItem.quizId && (
            <QuizBuilder
              quizId={currentItem.quizId}
              onInit={onInitQuiz}
              onQuestionsChange={onQuizChange}
              onValidationChange={onQuizValidation}
            />
          )}
        </div>

        {/* SINGLE Footer Save */}
        <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-gray-100 text-gray-600 rounded-xl text-[13px] font-bold hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || !isQuizReady || !isQuizValid}
            className={cn(
                "px-8 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center gap-2",
                isSaving || !isQuizReady || !isQuizValid
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100"
            )}
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {!isQuizReady ? "Loading Quiz..." : !isQuizValid ? "Incomplete Quiz" : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
};