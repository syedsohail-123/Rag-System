"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { DocumentUploader } from "./DocumentUploader";
import { useWorkspaceStore } from "@/lib/store/useWorkspaceStore";
import { ChevronLeft, ChevronRight, FileX, ArrowLeft, Plus, FileText, Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function PdfViewer() {
  const {
    documents,
    setDocuments,
    activeDocumentId,
    setActiveDocumentId,
    activePage,
    setActivePage,
    setTotalPages,
    totalPages,
    theme,
  } = useWorkspaceStore();

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isQuickUploading, setIsQuickUploading] = useState(false);
  const quickFileInputRef = useRef<HTMLInputElement>(null);

  const isLight = theme === "light";
  const activeDoc = documents.find((doc) => doc.id === activeDocumentId);

  // Quick upload from tab bar
  const handleQuickUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 25 * 1024 * 1024) {
      alert("File exceeds 25MB limit.");
      return;
    }

    setIsQuickUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const newDoc = await apiFetch<any>("/documents/upload", {
        method: "POST",
        body: formData,
      });
      const existing = useWorkspaceStore.getState().documents;
      setDocuments([newDoc, ...existing]);
      setActiveDocumentId(newDoc.id);
    } catch (err: any) {
      alert(err.message || "Failed to upload document");
    } finally {
      setIsQuickUploading(false);
    }
  };

  // Reliably fetch PDF as binary array buffer with Bearer token authentication
  useEffect(() => {
    if (!activeDoc) {
      setPdfData(null);
      return;
    }

    setIsLoadingPdf(true);
    setLoadError(null);

    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : "";
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const fileEndpoint = `${apiBase}/documents/${activeDoc.id}/file`;

    fetch(fileEndpoint, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load PDF document");
        const arrayBuf = await res.arrayBuffer();
        setPdfData(new Uint8Array(arrayBuf));
      })
      .catch((err) => {
        console.error("PDF preview load error:", err);
      })
      .finally(() => {
        setIsLoadingPdf(false);
      });
  }, [activeDoc?.id]);

  // Dual file source: Uint8Array binary buffer with URL fallback
  const fileSource = useMemo(() => {
    if (pdfData) return { data: pdfData };
    if (!activeDoc) return null;
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : "";
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/$/, "");
    return {
      url: `${apiBase}/documents/${activeDoc.id}/file`,
      httpHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      withCredentials: true,
    };
  }, [pdfData, activeDoc]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setTotalPages(numPages);
    setLoadError(null);
  };

  if (!activeDoc) {
    return (
      <div
        className={`h-full flex flex-col items-center justify-center p-8 border-r transition-colors ${
          isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950 text-slate-100 border-slate-800"
        }`}
      >
        <div className="w-full max-w-xl flex flex-col items-center">
          <DocumentUploader isFullWidth={true} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`h-full flex flex-col border-r transition-colors ${
        isLight ? "bg-white border-slate-200" : "bg-slate-950 border-slate-800"
      }`}
    >
      {/* 📑 Browser-Style Multi-Document Tabs Bar */}
      <div
        className={`h-11 border-b px-2 flex items-center gap-1.5 overflow-x-auto shrink-0 transition-colors ${
          isLight ? "bg-slate-100/90 border-slate-200" : "bg-slate-900/90 border-slate-800"
        }`}
      >
        <button
          onClick={() => setActiveDocumentId(null)}
          title="Back to Upload Dashboard"
          className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-lg shrink-0 transition-colors ${
            isLight
              ? "text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-200/80 border border-slate-300"
              : "text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700"
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Uploads</span>
        </button>

        {/* Document Tabs */}
        {documents.map((doc) => {
          const isActive = doc.id === activeDocumentId;
          return (
            <button
              key={doc.id}
              onClick={() => setActiveDocumentId(doc.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium max-w-[200px] truncate transition-all shrink-0 cursor-pointer ${
                isActive
                  ? isLight
                    ? "bg-white text-blue-600 border border-slate-300 shadow-xs font-bold"
                    : "bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm font-bold"
                  : isLight
                  ? "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border border-transparent"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
              }`}
            >
              <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-blue-500" : "text-slate-400"}`} />
              <span className="truncate">{doc.filename}</span>
            </button>
          );
        })}

        {/* Quick Upload Tab Button */}
        <input
          ref={quickFileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleQuickUpload(e.target.files)}
        />
        <button
          type="button"
          disabled={isQuickUploading}
          onClick={() => quickFileInputRef.current?.click()}
          title="Upload another document"
          className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-dashed transition-all shrink-0 cursor-pointer ${
            isLight
              ? "border-blue-400 text-blue-600 hover:bg-blue-50 bg-white"
              : "border-blue-500/40 text-blue-400 hover:bg-blue-500/10 bg-slate-900"
          }`}
        >
          {isQuickUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          <span>{isQuickUploading ? "Uploading..." : "Add PDF"}</span>
        </button>
      </div>

      {/* Page Navigation & Controls Subheader */}
      <div
        className={`h-9 border-b px-4 flex items-center justify-between text-xs shrink-0 transition-colors ${
          isLight ? "bg-slate-50 border-slate-200 text-slate-700" : "bg-slate-950/60 border-slate-800 text-slate-300"
        }`}
      >
        <span className="font-medium truncate max-w-[280px]">
          Viewing: <span className="font-bold">{activeDoc.filename}</span>
        </span>

        <div className="flex items-center gap-2">
          <button
            disabled={activePage <= 1}
            onClick={() => setActivePage(activePage - 1)}
            className={`p-1 rounded disabled:opacity-40 disabled:hover:bg-transparent ${
              isLight ? "hover:bg-slate-200 text-slate-700" : "hover:bg-slate-800 text-slate-300"
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className={isLight ? "text-slate-600 text-xs" : "text-slate-400 text-xs"}>
            Page <span className={`font-semibold ${isLight ? "text-slate-900" : "text-slate-200"}`}>{activePage}</span> of{" "}
            <span className={`font-semibold ${isLight ? "text-slate-900" : "text-slate-200"}`}>{numPages || totalPages}</span>
          </span>

          <button
            disabled={numPages ? activePage >= numPages : false}
            onClick={() => setActivePage(activePage + 1)}
            className={`p-1 rounded disabled:opacity-40 disabled:hover:bg-transparent ${
              isLight ? "hover:bg-slate-200 text-slate-700" : "hover:bg-slate-800 text-slate-300"
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF View Container */}
      <div className={`flex-1 overflow-auto p-4 flex justify-center ${isLight ? "bg-slate-100/50" : "bg-slate-950"}`}>
        {isLoadingPdf && !pdfData && (
          <div className="text-xs text-slate-400 py-16 flex flex-col items-center gap-2 animate-pulse">
            <span>Loading PDF document stream...</span>
          </div>
        )}

        {loadError && !fileSource && (
          <div className="text-xs text-rose-400 py-16 flex flex-col items-center gap-2 text-center">
            <FileX className="w-6 h-6 text-rose-500" />
            <span>{loadError}</span>
          </div>
        )}

        {fileSource && (
          <Document
            file={fileSource}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(err) => {
              console.warn("PDF worker load info:", err);
            }}
            loading={<div className="text-xs text-slate-400 py-10">Rendering pages...</div>}
            error={
              <div className="text-xs text-rose-400 py-10 flex flex-col items-center gap-2">
                <FileX className="w-6 h-6 text-rose-500" />
                <span>Failed to load document preview. Please refresh or re-upload.</span>
              </div>
            }
          >
            <Page
              key={`page_${activePage}`}
              pageNumber={activePage}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              width={550}
              loading={<div className="w-[550px] h-[750px] bg-slate-800/30 animate-pulse rounded-lg" />}
              className="shadow-xl rounded-lg overflow-hidden border border-slate-700/30"
            />
          </Document>
        )}
      </div>
    </div>
  );
}
