"use client";

import { useEffect } from "react";
import { FileText, Trash2, Loader2, CheckCircle2, MessageSquare } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/useWorkspaceStore";
import { DocumentStatus } from "@/lib/types";
import { apiFetch } from "@/lib/api";

const statusColors: Record<DocumentStatus, string> = {
  Uploaded: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  Parsing: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Chunking: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  Embedding: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
  Ready: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};

export function DocumentList() {
  const { documents, activeDocumentId, setActiveDocumentId, removeDocument, setChatHistory, chatHistory } =
    useWorkspaceStore();

  // Rehydrate persistent chat history when document is selected
  // useEffect(() => {
  //   if (activeDocumentId && !chatHistory[activeDocumentId]) {
  //     apiFetch(`/documents/${activeDocumentId}/history`)
  //       .then((history) => {
  //         if (Array.isArray(history)) {
  //           setChatHistory(activeDocumentId, history);
  //         }
  //       })
  //       .catch(() => {
  //         // Fallback empty list
  //       });
  //   }
  // }, [activeDocumentId, chatHistory, setChatHistory]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await apiFetch(`/documents/${id}`, { method: "DELETE" });
      removeDocument(id);
    } catch {
      removeDocument(id);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-slate-500">
        No documents or chat history yet.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {documents.map((doc) => {
        const isActive = doc.id === activeDocumentId;

        return (
          <div
            key={doc.id}
            onClick={() => setActiveDocumentId(doc.id)}
            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col gap-2 group ${
              isActive
                ? "bg-blue-600/10 border-blue-500/40 text-slate-100 shadow-lg"
                : "bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/60 text-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-400" : "text-slate-500"}`} />
                <p className="font-medium truncate">{doc.filename}</p>
              </div>

              <button
                onClick={(e) => handleDelete(e, doc.id)}
                title="Delete Document & Chat History"
                className="p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-rose-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono ${
                  statusColors[doc.status]
                }`}
              >
                {doc.status !== "Ready" ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-2.5 h-2.5" />
                )}
                {doc.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

