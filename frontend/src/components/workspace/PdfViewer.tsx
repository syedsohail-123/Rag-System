"use client";

import { useMemo, useState, useEffect } from "react";


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
    theme,
  } = useWorkspaceStore();

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isLight = theme === "light";
  const activeDoc = documents.find((doc) => doc.id === activeDocumentId);

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
        setLoadError("Failed to load document preview. Please refresh or re-upload.");
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
      {/* Controls Bar */}
      <div
        className={`h-10 border-b px-4 flex items-center justify-between text-xs shrink-0 transition-colors ${
          isLight ? "bg-slate-100/90 border-slate-200" : "bg-slate-900/50 border-slate-800"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setActiveDocumentId(null)}
            title="Back to Upload Dashboard"
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded transition-colors ${
              isLight
                ? "text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-200/80 border border-slate-300"
                : "text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700"
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <span
            className={`font-semibold truncate max-w-[200px] ${
              isLight ? "text-slate-800" : "text-slate-300"
            }`}
          >
            {activeDoc.filename}
          </span>
        </div>

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
