"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileText, AlertCircle, CheckCircle2, Loader2, Sparkles, Database, Layers } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/useWorkspaceStore";
import { apiFetch } from "@/lib/api";

interface DocumentUploaderProps {
  isFullWidth?: boolean;
}

interface UploadingFileItem {
  id: string;
  name: string;
  size: number;
  status: "queued" | "uploading" | "embedding" | "done" | "error";
  error?: string;
}

export function DocumentUploader({ isFullWidth = false }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadingFileItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { setActiveDocumentId, setDocuments, documents, theme } = useWorkspaceStore();
  const isLight = theme === "light";

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    const pdfFiles = Array.from(files).filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length === 0) {
      setError("Please select valid PDF documents.");
      return;
    }

    // Initialize multi-upload queue items
    const queueItems: UploadingFileItem[] = pdfFiles.map((file, idx) => ({
      id: `${file.name}-${idx}-${Date.now()}`,
      name: file.name,
      size: file.size,
      status: file.size > 25 * 1024 * 1024 ? "error" : "queued",
      error: file.size > 25 * 1024 * 1024 ? "Exceeds 25MB limit" : undefined,
    }));

    setUploadQueue(queueItems);
    setIsUploading(true);

    const validFiles = pdfFiles.filter((file) => file.size <= 25 * 1024 * 1024);
    const newlyCreatedDocs: any[] = [];

    // Process uploads concurrently
    await Promise.all(
      validFiles.map(async (file, idx) => {
        const fileId = queueItems.find((q) => q.name === file.name)?.id;

        // Update status to uploading
        setUploadQueue((prev) =>
          prev.map((item) => (item.id === fileId ? { ...item, status: "uploading" } : item))
        );

        const formData = new FormData();
        formData.append("file", file);

        try {
          // Fast simulated step: embedding
          setTimeout(() => {
            setUploadQueue((prev) =>
              prev.map((item) => (item.id === fileId ? { ...item, status: "embedding" } : item))
            );
          }, 300);

          const newDoc = await apiFetch<any>("/documents/upload", {
            method: "POST",
            body: formData,
          });

          newlyCreatedDocs.push(newDoc);

          setUploadQueue((prev) =>
            prev.map((item) => (item.id === fileId ? { ...item, status: "done" } : item))
          );
        } catch (err: any) {
          setUploadQueue((prev) =>
            prev.map((item) =>
              item.id === fileId ? { ...item, status: "error", error: err.message || "Failed" } : item
            )
          );
        }
      })
    );

    if (newlyCreatedDocs.length > 0) {
      const existing = useWorkspaceStore.getState().documents;
      setDocuments([...newlyCreatedDocs, ...existing]);
      setActiveDocumentId(newlyCreatedDocs[0].id);
    }

    // Brief delay to let the user see all checkmarks
    setTimeout(() => {
      setIsUploading(false);
      setUploadQueue([]);
    }, 800);
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
          isFullWidth ? "p-10 min-h-[320px] flex flex-col justify-center" : "p-4 text-center"
        } ${
          isDragging
            ? isLight
              ? "border-blue-500 bg-blue-50"
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
            <h3 className={`font-semibold ${isLight ? "text-slate-900" : "text-slate-100"} ${isFullWidth ? "text-base" : "text-xs"}`}>
              {isUploading ? "Batch Ingesting Documents..." : "Click or drag multiple PDF files to upload"}
            </h3>
            <p className={`mt-1 ${isLight ? "text-slate-500" : "text-slate-400"} ${isFullWidth ? "text-xs" : "text-[11px]"}`}>
              Supports selecting multiple PDFs simultaneously (up to 25MB each)
            </p>
          </div>
        </div>

        {/* Multi-Document Uploading Queue Status */}
        {isUploading && uploadQueue.length > 0 && (
          <div className="mt-6 w-full max-w-lg mx-auto space-y-2.5 text-left border-t border-slate-800/80 pt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Multi-Upload Queue ({uploadQueue.length} files)</span>
              </span>
              <span className="text-[11px] font-mono text-blue-400">
                {uploadQueue.filter((q) => q.status === "done").length} / {uploadQueue.length} Ready
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {uploadQueue.map((item) => (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                    item.status === "done"
                      ? isLight
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-emerald-950/40 border-emerald-800/50 text-emerald-300"
                      : item.status === "error"
                      ? isLight
                        ? "bg-rose-50 border-rose-200 text-rose-900"
                        : "bg-rose-950/40 border-rose-800/50 text-rose-300"
                      : isLight
                      ? "bg-white border-slate-200 text-slate-700"
                      : "bg-slate-900 border-slate-800 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 shrink-0 text-blue-400" />
                    <span className="font-medium truncate max-w-[220px]">{item.name}</span>
                    <span className={`text-[10px] ${isLight ? "text-slate-400" : "text-slate-500"}`}>
                      ({(item.size / (1024 * 1024)).toFixed(1)}MB)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === "queued" && (
                      <span className="text-[11px] text-slate-400">Queued</span>
                    )}
                    {item.status === "uploading" && (
                      <span className="text-[11px] text-blue-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Uploading
                      </span>
                    )}
                    {item.status === "embedding" && (
                      <span className="text-[11px] text-purple-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 animate-pulse" /> Vectorizing
                      </span>
                    )}
                    {item.status === "done" && (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                      </span>
                    )}
                    {item.status === "error" && (
                      <span className="text-[11px] text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {item.error || "Error"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="mt-4 p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center justify-center gap-2 text-center">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
