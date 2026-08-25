"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileText, AlertCircle, CheckCircle2, Loader2, Sparkles, Database } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/useWorkspaceStore";
import { apiFetch } from "@/lib/api";

interface DocumentUploaderProps {
  isFullWidth?: boolean;
}

export function DocumentUploader({ isFullWidth = false }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [activeFileName, setActiveFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { setActiveDocumentId, setDocuments, theme } = useWorkspaceStore();
  const isLight = theme === "light";

  const steps = [
    { label: "Uploaded", desc: "Raw PDF stored safely", icon: FileText },
    { label: "Parsing", desc: "Extracting layout text", icon: Loader2 },
    { label: "Chunking", desc: "800-1000 token splitting", icon: Sparkles },
    { label: "Embedding", desc: "Local ONNX 384-d vectors", icon: Database },
    { label: "Ready", desc: "RAG search activated", icon: CheckCircle2 },
  ];

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    const pdfFiles = Array.from(files).filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length === 0) {
      setError("Please select valid PDF documents.");
      return;
    }

    setIsUploading(true);
    const newlyCreatedDocs: any[] = [];

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      if (file.size > 25 * 1024 * 1024) {
        setError(`"${file.name}" exceeds 25MB limit.`);
        continue;
      }

      setActiveFileName(file.name);
      setCurrentStep(0);

      // Smooth slow-paced deliberate skeleton pipeline steps (1.2s - 1.5s per stage)
      const stepTimer1 = setTimeout(() => setCurrentStep(1), 1200);
      const stepTimer2 = setTimeout(() => setCurrentStep(2), 2500);
      const stepTimer3 = setTimeout(() => setCurrentStep(3), 4000);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const uploadPromise = apiFetch<any>("/documents/upload", {
          method: "POST",
          body: formData,
        });

        // Ensure minimum visual progress time so user sees the slow steps clearly
        const delayPromise = new Promise((resolve) => setTimeout(resolve, 5200));

        const [newDoc] = await Promise.all([uploadPromise, delayPromise]);

        setCurrentStep(4);
        newlyCreatedDocs.push(newDoc);

        // Pause on Ready step for 1.2 seconds so the user sees the green checkmark
        await new Promise((resolve) => setTimeout(resolve, 1200));
      } catch (err: any) {
        setError(err.message || `Failed to upload ${file.name}`);
      } finally {
        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        clearTimeout(stepTimer3);
      }
    }

    if (newlyCreatedDocs.length > 0) {
      const existing = useWorkspaceStore.getState().documents;
      setDocuments([...newlyCreatedDocs, ...existing]);
      setActiveDocumentId(newlyCreatedDocs[0].id);
    }

    setTimeout(() => {
      setIsUploading(false);
      setActiveFileName("");
    }, 400);
  };

  return (
    <div className={`w-full ${isFullWidth ? "p-0" : "p-4 border-b border-slate-800"}`}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl transition-all ${
          isFullWidth ? "p-10 min-h-[300px] flex flex-col justify-center" : "p-4 text-center"
        } ${
          isDragging
            ? isLight
              ? "border-blue-500 bg-blue-50/80"
              : "border-blue-500 bg-blue-500/10"
            : isLight
            ? "border-slate-300 hover:border-blue-500 bg-slate-50/70"
            : "border-slate-800 hover:border-slate-700 bg-slate-900/40"
        } ${isUploading ? "cursor-wait" : "cursor-pointer"}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
          }}
        />

        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <div
            className={`p-4 bg-blue-500/10 text-blue-500 rounded-full border border-blue-500/20 ${
              isFullWidth ? "w-16 h-16" : "w-10 h-10 p-2.5"
            }`}
          >
            <UploadCloud className="w-full h-full" />
          </div>
          <div>
            <h3
              className={`font-semibold ${isLight ? "text-slate-900" : "text-slate-100"} ${
                isFullWidth ? "text-base" : "text-xs"
              }`}
            >
              {isUploading
                ? `Ingesting: ${activeFileName || "Document"}`
                : "Click or drag multiple PDF files to upload"}
            </h3>
            <p
              className={`mt-1 ${isLight ? "text-slate-500" : "text-slate-400"} ${
                isFullWidth ? "text-xs" : "text-[11px]"
              }`}
            >
              Multi-file support (select 1 or multiple PDFs, up to 25MB each)
            </p>
          </div>
        </div>

        {/* 5-Step Skeleton Progress Pipeline */}
        {isUploading && (
          <div className="mt-6 w-full space-y-4 text-left border-t border-slate-200 dark:border-slate-800 pt-4">
            {/* Skeleton Loading Bar */}
            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isLight ? "bg-slate-200" : "bg-slate-800"}`}>
              <div
                className="bg-blue-500 h-full transition-all duration-1000 ease-in-out"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>

            {/* Individual Pipeline Step Badges */}
            <div className="grid grid-cols-5 gap-2">
              {steps.map((step, idx) => {
                const StepIcon = step.icon;
                const isCompleted = idx < currentStep;
                const isCurrent = idx === currentStep;

                return (
                  <div
                    key={step.label}
                    className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                      isCurrent
                        ? "bg-blue-500/15 border-blue-500/50 text-blue-500 animate-pulse font-bold"
                        : isCompleted
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                        : isLight
                        ? "bg-slate-100 border-slate-200 text-slate-400"
                        : "bg-slate-900/40 border-slate-800/50 text-slate-600"
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-full mb-1 ${
                        isCurrent
                          ? "bg-blue-500/20"
                          : isCompleted
                          ? "bg-emerald-500/20"
                          : isLight
                          ? "bg-slate-200"
                          : "bg-slate-800/40"
                      }`}
                    >
                      <StepIcon
                        className={`w-3.5 h-3.5 ${
                          isCurrent ? "animate-spin text-blue-500" : isCompleted ? "text-emerald-500" : ""
                        }`}
                      />
                    </div>
                    <span className="text-[10px] font-semibold tracking-wider uppercase">
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="mt-4 p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-center justify-center gap-2 text-center">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}


