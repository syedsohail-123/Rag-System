"use client";

import { useState, useRef } from "react";
import { FileText, AlertCircle, CheckCircle2, Loader2, Sparkles, Plus, Trash2, ArrowUpCircle } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/useWorkspaceStore";
import { apiFetch } from "@/lib/api";

interface DocumentUploaderProps {
  isFullWidth?: boolean;
}

interface SelectedFile {
  file: File;
  id: string;
  name: string;
  size: number;
}

interface UploadingFileItem {
  id: string;
  name: string;
  size: number;
  status: "queued" | "uploading" | "embedding" | "done" | "error";
  error?: string;
}

export function DocumentUploader({ isFullWidth = false }: DocumentUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadingFileItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { setActiveDocumentId, setDocuments, theme } = useWorkspaceStore();
  const isLight = theme === "light";

  const handleSelectFiles = (files: FileList | File[]) => {
    setError(null);
    const pdfFiles = Array.from(files).filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length === 0) {
      setError("Please select valid PDF documents.");
      return;
    }

    const newSelected: SelectedFile[] = pdfFiles.map((file, idx) => ({
      file,
      id: `${file.name}-${idx}-${Date.now()}`,
      name: file.name,
      size: file.size,
    }));

    setSelectedFiles((prev) => [...prev, ...newSelected]);
  };

  const removeSelectedFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUploadAll = async () => {
    if (selectedFiles.length === 0) return;
    setError(null);

    const queueItems: UploadingFileItem[] = selectedFiles.map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      status: f.size > 25 * 1024 * 1024 ? "error" : "queued",
      error: f.size > 25 * 1024 * 1024 ? "Exceeds 25MB limit" : undefined,
    }));

    setUploadQueue(queueItems);
    setIsUploading(true);

    const validFiles = selectedFiles.filter((f) => f.size <= 25 * 1024 * 1024);
    const newlyCreatedDocs: any[] = [];

    await Promise.all(
      validFiles.map(async ({ file, id }) => {
        setUploadQueue((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: "uploading" } : item))
        );

        const formData = new FormData();
        formData.append("file", file);

        try {
          setTimeout(() => {
            setUploadQueue((prev) =>
              prev.map((item) => (item.id === id ? { ...item, status: "embedding" } : item))
            );
          }, 300);

          const newDoc = await apiFetch<any>("/documents/upload", {
            method: "POST",
            body: formData,
          });

          newlyCreatedDocs.push(newDoc);

          setUploadQueue((prev) =>
            prev.map((item) => (item.id === id ? { ...item, status: "done" } : item))
          );
        } catch (err: any) {
          setUploadQueue((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, status: "error", error: err.message || "Failed" } : item
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

    setTimeout(() => {
      setIsUploading(false);
      setSelectedFiles([]);
      setUploadQueue([]);
    }, 700);
  };

  return (
    <div className={`w-full ${isFullWidth ? "p-0" : "p-4 border-b border-slate-800"}`}>
      <div
        className={`rounded-2xl border p-6 transition-all ${
          isLight
            ? "bg-white border-slate-200 shadow-sm"
            : "bg-slate-900/60 border-slate-800 shadow-xl"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleSelectFiles(e.target.files);
          }}
        />

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600/10 text-blue-500 rounded-xl border border-blue-500/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className={`font-bold text-sm ${isLight ? "text-slate-900" : "text-slate-100"}`}>
                Upload Documents
              </h3>
              <p className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                Select single or multiple PDF documents for vector indexing (up to 25MB each)
              </p>
            </div>
          </div>

          {/* Action Button to Select Files */}
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Select PDF Files</span>
          </button>
        </div>

        {/* Selected Files List (Staged for Upload) */}
        {selectedFiles.length > 0 && !isUploading && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Selected Files ({selectedFiles.length})</span>
              <button
                type="button"
                onClick={() => setSelectedFiles([])}
                className="text-rose-500 hover:text-rose-600 text-[11px]"
              >
                Clear all
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {selectedFiles.map((file) => (
                <div
                  key={file.id}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                    isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className={`font-semibold truncate max-w-[280px] ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                      {file.name}
                    </span>
                    <span className={`text-[11px] ${isLight ? "text-slate-400" : "text-slate-500"}`}>
                      ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeSelectedFile(file.id)}
                    title="Remove file"
                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Ingest & Upload Button */}
            <div className="pt-3 flex justify-end">
              <button
                type="button"
                onClick={handleUploadAll}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer"
              >
                <ArrowUpCircle className="w-4 h-4" />
                <span>Ingest & Vectorize ({selectedFiles.length}) Documents</span>
              </button>
            </div>
          </div>
        )}

        {/* Live Multi-Upload Queue Progress */}
        {isUploading && uploadQueue.length > 0 && (
          <div className="mt-5 space-y-2.5 text-left border-t border-slate-200 dark:border-slate-800 pt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Ingesting Documents ({uploadQueue.length} files)</span>
              <span className="text-[11px] font-mono text-blue-500">
                {uploadQueue.filter((q) => q.status === "done").length} / {uploadQueue.length} Ready
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {uploadQueue.map((item) => (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    item.status === "done"
                      ? isLight
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-emerald-950/40 border-emerald-800/50 text-emerald-300"
                      : item.status === "error"
                      ? isLight
                        ? "bg-rose-50 border-rose-200 text-rose-900"
                        : "bg-rose-950/40 border-rose-800/50 text-rose-300"
                      : isLight
                      ? "bg-slate-50 border-slate-200 text-slate-700"
                      : "bg-slate-950 border-slate-800 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="font-semibold truncate max-w-[240px]">{item.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === "queued" && (
                      <span className="text-[11px] text-slate-400">Queued</span>
                    )}
                    {item.status === "uploading" && (
                      <span className="text-[11px] text-blue-500 flex items-center gap-1 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" /> Uploading
                      </span>
                    )}
                    {item.status === "embedding" && (
                      <span className="text-[11px] text-purple-500 flex items-center gap-1 font-medium">
                        <Sparkles className="w-3 h-3 animate-pulse" /> Vectorizing
                      </span>
                    )}
                    {item.status === "done" && (
                      <span className="text-[11px] text-emerald-500 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                      </span>
                    )}
                    {item.status === "error" && (
                      <span className="text-[11px] text-rose-500 flex items-center gap-1">
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
          <div className="mt-4 p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-center justify-center gap-2 text-center">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

