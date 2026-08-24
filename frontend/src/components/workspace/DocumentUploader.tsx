"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileText, AlertCircle, CheckCircle2, Loader2, Sparkles, Database } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/useWorkspaceStore";

interface DocumentUploaderProps {
  isFullWidth?: boolean;
}

export function DocumentUploader({ isFullWidth = false }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { setActiveDocumentId } = useWorkspaceStore();

  const steps = [
    { label: "Uploaded", desc: "Raw PDF stored safely", icon: FileText },
    { label: "Parsing", desc: "Extracting layout text", icon: Loader2 },
    { label: "Chunking", desc: "800-1000 token splitting", icon: Sparkles },
    { label: "Embedding", desc: "Local ONNX 384-d vectors", icon: Database },
    { label: "Ready", desc: "RAG search activated", icon: CheckCircle2 },
  ];

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    const pdfFiles = Array.from(files).filter((file) => file.type === "application/pdf");

    if (pdfFiles.length === 0) {
      setError("Please select valid PDF files.");
      return;
    }

    for (const file of pdfFiles) {
      if (file.size > 25 * 1024 * 1024) {
        setError(`"${file.name}" exceeds maximum allowed size of 25MB.`);
        continue;
      }

      setIsUploading(true);
      setCurrentStep(0);

      // Step Progress Timed Simulation
      const stepTimer1 = setTimeout(() => setCurrentStep(1), 600);
      const stepTimer2 = setTimeout(() => setCurrentStep(2), 1200);
      const stepTimer3 = setTimeout(() => setCurrentStep(3), 1800);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"}/documents/upload`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          }
        );

        if (!response.ok) {
          throw new Error("Failed to upload PDF");
        }

        setCurrentStep(4);
        const newDoc = await response.json();
        
        // Small delay to show completion checkmark
        setTimeout(() => {
          setActiveDocumentId(newDoc.id);
          useWorkspaceStore.getState().setDocuments([
            newDoc,
            ...useWorkspaceStore.getState().documents,
          ]);
        }, 500);

      } catch (err: any) {
        setError(err.message || "File upload failed.");
      } finally {
        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        clearTimeout(stepTimer3);
        setIsUploading(false);
      }
    }
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
            ? "border-blue-500 bg-blue-500/10"
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
          <div className={`p-4 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20 ${isFullWidth ? "w-16 h-16" : "w-10 h-10 p-2.5"}`}>
            <UploadCloud className="w-full h-full" />
          </div>
          <div>
            <h3 className={`font-semibold text-slate-100 ${isFullWidth ? "text-base" : "text-xs"}`}>
              {isUploading ? "Processing Document Ingestion..." : "Click or drag PDF files to upload"}
            </h3>
            <p className={`text-slate-400 mt-1 ${isFullWidth ? "text-xs" : "text-[11px]"}`}>
              Multi-file drag-and-drop support up to 25MB per PDF
            </p>
          </div>
        </div>

        {/* Step Progress & Skeleton Loading during upload */}
        {isUploading && (
          <div className="mt-6 w-full space-y-4 text-left border-t border-slate-800/80 pt-4">
            {/* Skeleton Loading Bar */}
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-500"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>

            {/* Ingestion Steps */}
            <div className="grid grid-cols-5 gap-2">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isCurrent = idx === currentStep;
                const isDone = idx < currentStep;

                return (
                  <div
                    key={step.label}
                    className={`flex flex-col items-center text-center p-2 rounded-lg border transition-colors ${
                      isCurrent
                        ? "bg-blue-600/20 border-blue-500/50 text-blue-300 animate-pulse"
                        : isDone
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-slate-900/30 border-slate-800 text-slate-600"
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1 ${isCurrent && "animate-spin"}`} />
                    <span className="text-[10px] font-medium">{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 text-xs text-rose-400 flex items-center gap-1.5 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

