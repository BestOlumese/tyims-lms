"use client";

import { useState } from "react";
import { UploadButton } from "@/lib/uploadthing-utils";
import { UploadCloud, Loader2 } from "lucide-react";

interface UploadAreaProps {
  endpoint: any;
  input?: any;
  onClientUploadComplete: (res: any) => void;
  onUploadError: (e: Error) => void;
  accent?: "indigo" | "emerald";
  label: string;
  sublabel: string;
  icon?: any;
}

export function UploadArea({
  endpoint,
  input,
  onClientUploadComplete,
  onUploadError,
  accent = "indigo",
  label,
  sublabel,
  icon: Icon = UploadCloud,
}: UploadAreaProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "done">("idle");
  const [fileName, setFileName] = useState("");

  const colors = {
    indigo: {
      bg: "bg-indigo-50/60",
      border: "border-indigo-200",
      icon: "text-indigo-500",
      iconBg: "bg-indigo-100",
      button: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100",
      progress: "bg-indigo-500",
      progressTrack: "bg-indigo-100",
      text: "text-indigo-600",
    },
    emerald: {
      bg: "bg-emerald-50/60",
      border: "border-emerald-200",
      icon: "text-emerald-500",
      iconBg: "bg-emerald-100",
      button: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100",
      progress: "bg-emerald-500",
      progressTrack: "bg-emerald-100",
      text: "text-emerald-600",
    },
  }[accent];

  return (
    <div className={`rounded-2xl border-2 border-dashed ${colors.border} ${colors.bg} p-6 transition-all`}>
      <div className="flex flex-col items-center gap-4">
        {/* Icon */}
        <div className={`p-4 rounded-2xl ${colors.iconBg}`}>
          <Icon size={28} className={colors.icon} />
        </div>

        {/* Labels */}
        <div className="text-center space-y-1">
          <p className="text-[14px] font-bold text-gray-800">{label}</p>
          <p className="text-[12px] text-gray-400 font-medium">{sublabel}</p>
        </div>

        {/* Progress bar — shown while uploading */}
        {status === "uploading" && (
          <div className="w-full space-y-2">
            <div className={`w-full h-2 rounded-full ${colors.progressTrack} overflow-hidden`}>
              <div
                className={`h-full rounded-full ${colors.progress} transition-all duration-300`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-gray-500 truncate max-w-[200px]">
                {fileName || "Uploading…"}
              </p>
              <p className={`text-[12px] font-bold ${colors.text}`}>{progress}%</p>
            </div>
          </div>
        )}

        {/* Upload button — hidden during upload */}
        {status !== "uploading" && (
          <div className="relative z-50">
            <UploadButton
              // `endpoint` is typed `any`, so UploadThing can't narrow which FileRoute is
              // in play and rejects `input` — even though chapterVideo really does declare
              // `.input({ lessonId })`. Cast keeps the correct runtime behaviour.
              {...({ endpoint, input } as any)}
              onUploadBegin={(name) => {
                setFileName(name);
                setStatus("uploading");
                setProgress(0);
              }}
              onUploadProgress={(p) => setProgress(p)}
              onClientUploadComplete={(res) => {
                setStatus("done");
                setProgress(100);
                onClientUploadComplete(res);
              }}
              onUploadError={(error: Error) => {
                setStatus("idle");
                setProgress(0);
                onUploadError(error);
              }}
              appearance={{
                container: "flex flex-col items-center gap-0",
                button: `${colors.button} text-white rounded-xl text-[13px] font-bold px-6 py-2.5 shadow-lg transition-all active:scale-[0.98] w-auto`,
                allowedContent: "hidden",
              }}
              content={{
                button({ ready }) {
                  if (!ready) return <Loader2 size={16} className="animate-spin" />;
                  return "Choose File";
                },
              }}
            />
          </div>
        )}

        {/* Uploading spinner label */}
        {status === "uploading" && (
          <div className="flex items-center gap-2">
            <Loader2 size={14} className={`animate-spin ${colors.text}`} />
            <span className={`text-[12px] font-bold ${colors.text}`}>Uploading, please wait…</span>
          </div>
        )}
      </div>
    </div>
  );
}
