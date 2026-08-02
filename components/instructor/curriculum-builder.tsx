"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  DragDropContext, 
  Droppable, 
  Draggable,
  DropResult
} from "@hello-pangea/dnd";
import { 
  Plus, 
  GripVertical, 
  Video, 
  FileText, 
  HelpCircle,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileIcon,
  Save,
  X
} from "lucide-react";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ItemEditorModal } from "./item-editor-modal";

import { ConfirmModal } from "../shared/confirm-modal";

interface CurriculumBuilderProps {
  courseId: string;
  initialChapters?: any[];
}

export const CurriculumBuilder = ({ courseId, initialChapters }: CurriculumBuilderProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const queryKey = orpc.instructor.getChapters.queryOptions({ input: { courseId } }).queryKey;
  
  const [isCreatingChapter, setIsCreatingChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: "chapter" | "item" } | null>(null);

  const { data: chapters = [], isLoading, refetch } = useQuery({
    ...orpc.instructor.getChapters.queryOptions({ input: { courseId } }),
    initialData: initialChapters,
    enabled: !!courseId,
  });

  const createChapterMutation = useMutation({
    ...orpc.instructor.createChapter.mutationOptions(),
    onMutate: async (newChapter) => {
      await queryClient.cancelQueries({ queryKey });
      const previousChapters = queryClient.getQueryData(queryKey);
      
      const optimisticChapter = {
        id: "temp-" + Date.now(),
        title: newChapter.title,
        lessons: [],
        orderIndex: (previousChapters as any[] || []).length,
      };
      
      queryClient.setQueryData(queryKey, (old: any[] = []) => [...old, optimisticChapter]);
      return { previousChapters };
    },
    onSuccess: (data) => {
        // Update the temp ID with the real one in the cache
        queryClient.setQueryData(queryKey, (old: any[] = []) => 
            old.map(c => c.id.startsWith("temp-") && c.title === data.title ? { ...c, id: data.id } : c)
        );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      router.refresh();
    },
  });

  const createLessonMutation = useMutation({
    ...orpc.instructor.createLesson.mutationOptions(),
    onMutate: async (newLesson) => {
        await queryClient.cancelQueries({ queryKey });
        const previousChapters = queryClient.getQueryData(queryKey) as any[];
        
        const newChapters = previousChapters.map(c => {
            if (c.id === newLesson.chapterId) {
                return {
                    ...c,
                    lessons: [
                        ...(c.lessons || []),
                        {
                            id: "temp-lesson-" + Date.now(),
                            title: newLesson.title,
                            type: newLesson.type,
                            orderIndex: (c.lessons || []).length,
                        }
                    ]
                };
            }
            return c;
        });
        queryClient.setQueryData(queryKey, newChapters);
        return { previousChapters };
    },
    onSuccess: (data, variables) => {
        // Sync ALL server data (id, quizId, etc.) into the optimistic item
        queryClient.setQueryData(queryKey, (old: any[] = []) => 
            old.map(c => {
                if (c.id === variables.chapterId) {
                    return {
                        ...c,
                        lessons: (c.lessons || []).map((l: any) => 
                            l.id.startsWith("temp-lesson-") && l.title === data.title 
                              ? { ...l, ...data } 
                              : l
                        )
                    };
                }
                return c;
            })
        );
    },
    onError: (err, newLesson, context) => {
        queryClient.setQueryData(queryKey, context?.previousChapters);
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey });
        router.refresh();
    }
  });

  const deleteLessonMutation = useMutation({
    ...orpc.instructor.deleteLesson.mutationOptions(),
    onMutate: async ({ id }) => {
        await queryClient.cancelQueries({ queryKey });
        const previousChapters = queryClient.getQueryData(queryKey) as any[];
        
        const newChapters = previousChapters.map(c => ({
            ...c,
            lessons: (c.lessons || []).filter((l: any) => l.id !== id)
        }));
        queryClient.setQueryData(queryKey, newChapters);
        return { previousChapters };
    },
    onError: (err, variables, context) => {
        queryClient.setQueryData(queryKey, context?.previousChapters);
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey });
        router.refresh();
    }
  });

  const updateChapterMutation = useMutation({
    ...orpc.instructor.updateChapter.mutationOptions(),
    onMutate: async (updatedChapter) => {
        await queryClient.cancelQueries({ queryKey });
        const previousChapters = queryClient.getQueryData(queryKey) as any[];
        
        const newChapters = previousChapters.map(c => 
            c.id === updatedChapter.id ? { ...c, title: updatedChapter.title } : c
        );
        queryClient.setQueryData(queryKey, newChapters);
        return { previousChapters };
    },
    onError: (err, updatedChapter, context) => {
        queryClient.setQueryData(queryKey, context?.previousChapters);
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey });
        router.refresh();
    }
  });

  const deleteChapterMutation = useMutation({
    ...orpc.instructor.deleteChapter.mutationOptions(),
    onMutate: async ({ id }) => {
        await queryClient.cancelQueries({ queryKey });
        const previousChapters = queryClient.getQueryData(queryKey) as any[];
        
        const newChapters = previousChapters.filter(c => c.id !== id);
        queryClient.setQueryData(queryKey, newChapters);
        return { previousChapters };
    },
    onError: (err, variables, context) => {
        queryClient.setQueryData(queryKey, context?.previousChapters);
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey });
        router.refresh();
    }
  });

  const reorderChaptersMutation = useMutation({
    ...orpc.instructor.reorderChapters.mutationOptions(),
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey });
        router.refresh();
    }
  });

  const reorderLessonsMutation = useMutation({
    ...orpc.instructor.reorderLessons.mutationOptions(),
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey });
        router.refresh();
    }
  });

  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const toggleChapter = (id: string) => {
    setExpandedChapters(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, type } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (type === "chapter") {
        const currentChapters = queryClient.getQueryData(queryKey) as any[];
        const newChapters = Array.from(currentChapters);
        const [reorderedItem] = newChapters.splice(source.index, 1);
        newChapters.splice(destination.index, 0, reorderedItem);

        queryClient.setQueryData(queryKey, newChapters);

        toast.promise(
            reorderChaptersMutation.mutateAsync(
                newChapters.map((chapter, index) => ({
                    id: chapter.id,
                    position: index,
                }))
            ),
            {
                loading: "Saving order...",
                success: "Order saved",
                error: "Failed to save order",
                id: "reorder-chapters",
            }
        );
    }

    if (type === "item") {
        const chapterId = source.droppableId;
        const currentChapters = queryClient.getQueryData(queryKey) as any[];
        const chapter = currentChapters.find(c => c.id === chapterId);
        if (!chapter) return;

        const newLessons: any[] = Array.from(chapter.lessons || []);
        const [reorderedLesson] = newLessons.splice(source.index, 1);
        newLessons.splice(destination.index, 0, reorderedLesson);

        const newChapters = currentChapters.map(c => 
            c.id === chapterId ? { ...c, lessons: newLessons } : c
        );
        queryClient.setQueryData(queryKey, newChapters);

        toast.promise(
          reorderLessonsMutation.mutateAsync(
            newLessons.map((item, index) => ({ id: item.id, position: index }))
          ),
          {
            loading: "Saving order...",
            success: "Order saved",
            error: "Failed to save order",
            id: `reorder-items-${chapterId}`,
          }
        );
    }
  };

  const addChapter = async () => {
    if (!newChapterTitle.trim()) return;
    toast.promise(
      createChapterMutation.mutateAsync({
        courseId,
        title: newChapterTitle,
      }),
      {
        loading: "Creating chapter...",
        success: () => {
          setNewChapterTitle("");
          setIsCreatingChapter(false);
          return "Chapter created";
        },
        error: "Failed to create chapter",
      }
    );
  };

  const updateChapter = async (id: string) => {
    if (!editingTitle.trim()) return;
    toast.promise(
      updateChapterMutation.mutateAsync({
        id,
        title: editingTitle,
      }),
      {
        loading: "Updating...",
        success: () => {
          setEditingChapterId(null);
          return "Chapter updated";
        },
        error: "Failed to update",
      }
    );
  };

  const handleDelete = () => {
      if (!confirmDelete) return;

      if (confirmDelete.type === "chapter") {
          toast.promise(
              deleteChapterMutation.mutateAsync({ id: confirmDelete.id }),
              {
                  loading: "Deleting chapter...",
                  success: "Chapter deleted",
                  error: "Failed to delete chapter",
              }
          );
      } else {
          toast.promise(
              deleteLessonMutation.mutateAsync({ id: confirmDelete.id }),
              {
                  loading: "Deleting...",
                  success: "Deleted",
                  error: "Failed to delete",
                  id: `delete-item-${confirmDelete.id}`,
              }
          );
      }
      setConfirmDelete(null);
  };

  useEffect(() => {
    // Sync initialChapters to cache if needed, but useQuery handles it with initialData
  }, [initialChapters]);

  // Rest of the UI...
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title={confirmDelete?.type === "chapter" ? "Delete Chapter" : "Delete Item"}
        description={confirmDelete?.type === "chapter" 
            ? "Are you sure? This will delete all lessons inside this chapter. This action cannot be undone."
            : "Are you sure you want to delete this item? This action cannot be undone."}
        isLoading={deleteChapterMutation.isPending || deleteLessonMutation.isPending}
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Course Curriculum</h2>
          <p className="text-[13px] text-gray-500 font-medium">Organize your course into chapters and items.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreatingChapter(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[13px] font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus size={18} />
          Add Chapter
        </button>
      </div>

      {isCreatingChapter && (
        <div className="p-6 bg-gray-50 border border-gray-100 rounded-2xl space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-gray-700">Chapter Title</label>
            <input
              autoFocus
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              placeholder="e.g. Introduction to React"
              className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 transition-all"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={addChapter}
              disabled={createChapterMutation.isPending}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-[12px] font-bold hover:bg-indigo-700 transition-all"
            >
              Save Chapter
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingChapter(false)}
              className="px-5 py-2 bg-white border border-gray-100 text-gray-600 rounded-xl text-[12px] font-bold hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="chapters" type="chapter">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
              {chapters.map((chapter, index) => (
                <Draggable key={chapter.id} draggableId={chapter.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm shadow-gray-200/5"
                    >
                      <div className="flex items-center gap-4 p-4 bg-gray-50/50 border-b border-gray-50">
                        <div {...provided.dragHandleProps}>
                          <GripVertical size={18} className="text-gray-400 cursor-grab" />
                        </div>
                        {editingChapterId === chapter.id ? (
                          <div className="flex-1 flex items-center gap-2">
                             <input
                                autoFocus
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                className="flex-1 px-3 py-1 bg-white border border-indigo-200 rounded-lg text-[14px] font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") updateChapter(chapter.id);
                                    if (e.key === "Escape") setEditingChapterId(null);
                                }}
                             />
                             <button 
                                type="button"
                                onClick={() => updateChapter(chapter.id)}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                             >
                                <Save size={16} />
                             </button>
                             <button 
                                type="button"
                                onClick={() => setEditingChapterId(null)}
                                className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg transition-all"
                             >
                                <X size={16} />
                             </button>
                          </div>
                        ) : (
                          <>
                            <h3 
                                className="flex-1 text-[14px] font-bold text-gray-900 cursor-pointer"
                                onClick={() => toggleChapter(chapter.id)}
                            >
                                {chapter.title}
                            </h3>
                            <div className="flex items-center gap-1">
                              <button 
                                type="button"
                                onClick={() => {
                                    setEditingChapterId(chapter.id);
                                    setEditingTitle(chapter.title);
                                }}
                                className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg transition-all"
                              >
                                <Pencil size={16} />
                              </button>
                              <button 
                                type="button"
                                onClick={() => setConfirmDelete({ id: chapter.id, type: "chapter" })}
                                className="p-2 text-gray-400 hover:text-rose-600 rounded-lg transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                              <button 
                                type="button"
                                onClick={() => toggleChapter(chapter.id)}
                                className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg transition-all ml-1"
                              >
                                {expandedChapters.has(chapter.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      <div className={cn(
                        "grid transition-all duration-300 ease-in-out",
                        expandedChapters.has(chapter.id) ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      )}>
                        <div className="overflow-hidden p-0 px-4">
                          <div className="py-4">
                            <ChapterItems 
                              courseId={courseId}
                              chapterId={chapter.id} 
                              lessons={chapter.lessons || []}
                              onAdd={(type) => {
                                if (chapter.id.startsWith("temp-")) {
                                    toast.error("Please wait for chapter to save...");
                                    return;
                                }
                                toast.promise(
                                    createLessonMutation.mutateAsync({
                                      chapterId: chapter.id,
                                      title: `New ${type.toLowerCase()}`,
                                      type
                                    }),
                                    {
                                      loading: "Adding item...",
                                      success: "Item added",
                                      error: "Failed to add item",
                                    }
                                );
                              }}
                              onDelete={(id) => setConfirmDelete({ id, type: "item" })}
                              refetch={() => {
                                queryClient.invalidateQueries({ queryKey });
                                router.refresh();
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {chapters.length === 0 && !isCreatingChapter && !isLoading && (
        <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-3xl">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Plus size={32} className="text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No chapters yet</h3>
          <p className="text-[13px] text-gray-500 font-medium">Click the button above to start building your course.</p>
        </div>
      )}
    </div>
  );
};

interface ChapterItemsProps {
    courseId: string;
    chapterId: string;
    lessons: any[];
    onAdd: (type: "VIDEO" | "QUIZ" | "FILE") => void;
    onDelete: (id: string) => void;
    refetch: () => void;
}

const ChapterItems = ({ courseId, chapterId, lessons, onAdd, onDelete, refetch }: ChapterItemsProps) => {
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  return (
    <div className="space-y-4">
        <Droppable droppableId={chapterId} type="item">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
              {lessons.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl group hover:border-indigo-100 hover:bg-indigo-50/10 transition-all"
                    >
                      <div {...provided.dragHandleProps}>
                        <GripVertical size={14} className="text-gray-300" />
                      </div>
                      <div className={cn(
                        "p-2 rounded-lg",
                        item.type === "VIDEO" ? "bg-indigo-50 text-indigo-600" : 
                        item.type === "QUIZ" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                      )}>
                        {item.type === "VIDEO" ? <Video size={16} /> : 
                         item.type === "QUIZ" ? <HelpCircle size={16} /> : <FileText size={16} />}
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-bold text-gray-900">{item.title}</p>
                        <p className="text-[11px] text-gray-400 font-medium">{item.type}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                            type="button"
                            onMouseEnter={() => {
                              if (item.type === "QUIZ" && item.quizId && !item.id.startsWith("temp-")) {
                                queryClient.prefetchQuery(
                                  orpc.instructor.getQuestions.queryOptions({ input: { quizId: item.quizId } })
                                );
                              }
                            }}
                            onClick={() => {
                                if (item.id.startsWith("temp-")) {
                                    toast.error("Please wait for item to save...");
                                    return;
                                }
                                setSelectedItem(item);
                                setIsModalOpen(true);
                            }}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                            <Pencil size={14} />
                        </button>
                        <button 
                            type="button"
                            onClick={() => onDelete(item.id)}
                            className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                            <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

      {selectedItem && (
          <ItemEditorModal 
            courseId={courseId}
            item={selectedItem}
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSuccess={refetch}
          />
      )}

      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => onAdd("VIDEO")}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-50/30 border border-indigo-100/50 rounded-xl text-[12px] font-bold text-indigo-600 hover:bg-indigo-50/50 transition-all"
        >
          <Video size={16} />
          Add Video
        </button>
        <button
          type="button"
          onClick={() => onAdd("QUIZ")}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-50/30 border border-amber-100/50 rounded-xl text-[12px] font-bold text-amber-600 hover:bg-amber-50/50 transition-all"
        >
          <HelpCircle size={16} />
          Add Quiz
        </button>
        <button
          type="button"
          onClick={() => onAdd("FILE")}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50/30 border border-emerald-100/50 rounded-xl text-[12px] font-bold text-emerald-600 hover:bg-emerald-50/50 transition-all"
        >
          <FileText size={16} />
          Add File
        </button>
      </div>
    </div>
  );
};
