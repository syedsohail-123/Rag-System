"use client";

import { useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { DocumentUploader } from "./DocumentUploader";
import { useWorkspaceStore } from "@/lib/store/useWorkspaceStore";
import { ChevronLeft, ChevronRight, FileX, ArrowLeft } from "lucide-react";



// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function PdfViewer() {
  const {
    documents,
    activeDocumentId,
    setActiveDocumentId,
    activePage,
    setActivePage,
    setTotalPages,
    totalPages,
  } = useWorkspaceStore();

  const [numPages, setNumPages] = useState<number | null>(null);

  const activeDoc = documents.find((doc) => doc.id === activeDocumentId);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setTotalPages(numPages);
  };

  const pdfFile = useMemo(() => {
    if (!activeDoc) return null;
    const rawUrl = activeDoc.file_url || `/documents/${activeDoc.id}/file`;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const fullUrl = rawUrl.startsWith("http")
      ? rawUrl
      : `${apiBase}${rawUrl.replace(/^\/api/, "")}`;
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    return {
      url: fullUrl,
      httpHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      withCredentials: true,
    };
  }, [activeDoc]);

  if (!activeDoc || !pdfFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-950 text-slate-100 border-r border-slate-800">
        <div className="w-full max-w-xl flex flex-col items-center">
          <DocumentUploader isFullWidth={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 border-r border-slate-800">
      {/* Controls Bar */}
      <div className="h-10 border-b border-slate-800 px-4 flex items-center justify-between bg-slate-900/50 text-xs shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setActiveDocumentId(null)}
            title="Back to Upload Dashboard"
            className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <span className="font-medium text-slate-300 truncate max-w-[200px]">
            {activeDoc.filename}
          </span>
        </div>


        <div className="flex items-center gap-2">
          <button
            disabled={activePage <= 1}
            onClick={() => setActivePage(activePage - 1)}
            className="p-1 rounded hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-slate-400">
            Page <span className="text-slate-200 font-medium">{activePage}</span> of{" "}
            <span className="text-slate-200 font-medium">{numPages || totalPages}</span>
          </span>

          <button
            disabled={numPages ? activePage >= numPages : false}
            onClick={() => setActivePage(activePage + 1)}
            className="p-1 rounded hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF View Container */}
      <div className="flex-1 overflow-auto p-4 flex justify-center bg-slate-950">
        <Document
          file={pdfFile}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(err) => console.warn("PDF worker load info:", err)}
          loading={
            <div className="text-xs text-slate-500 py-10">Loading PDF document...</div>
          }
          error={
            <div className="text-xs text-rose-400 py-10 flex flex-col items-center gap-2">
              <FileX className="w-6 h-6 text-rose-500" />
              <span>Failed to load PDF preview. Please re-upload the document.</span>
            </div>
          }
        >
          <Page
  key={`page_${activePage}`}
  pageNumber={activePage}
  renderTextLayer={true}
  renderAnnotationLayer={false}
  width={550}
  loading={<div className="w-[550px] h-[750px] bg-slate-900 animate-pulse rounded" />}
  className="shadow-xl rounded overflow-hidden"
/>
        </Document>
      </div>
    </div>
  );
}
