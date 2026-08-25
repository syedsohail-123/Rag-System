"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/workspace/Navbar";
import { DocumentList } from "@/components/workspace/DocumentList";
import { ChatInterface } from "@/components/workspace/ChatInterface";
import { useWorkspaceStore } from "@/lib/store/useWorkspaceStore";
import { apiFetch } from "@/lib/api";
import { Files, FileText, MessageSquare, Plus } from "lucide-react";

const PdfViewer = dynamic(
  () => import("@/components/workspace/PdfViewer").then((mod) => mod.PdfViewer),
  { ssr: false }
);

export default function WorkspacePage() {
  const { setDocuments, documents, theme, setUserEmail, activeDocumentId, setActiveDocumentId } =
    useWorkspaceStore();
  const router = useRouter();
  const [mobileTab, setMobileTab] = useState<"docs" | "pdf" | "chat">("pdf");

  useEffect(() => {
    // Automatically switch to PDF viewer on mobile when a document is chosen
    if (activeDocumentId) {
      setMobileTab("pdf");
    }
  }, [activeDocumentId]);

  useEffect(() => {
    // 1. Fetch user profile
    apiFetch<{ email: string }>("/auth/me")
      .then((res) => {
        if (res.email) {
          setUserEmail(res.email);
          if (typeof window !== "undefined") {
            localStorage.setItem("user_email", res.email);
          }
        }
      })
      .catch(() => {});

    // 2. Verify session & rehydrate documents on dashboard mount
    apiFetch<typeof documents>("/documents")
      .then((docs) => {
        if (Array.isArray(docs) && docs.length > 0) {
          setDocuments(docs);
        }
      })
      .catch(() => {
        router.push("/login");
      });
  }, [setDocuments, setUserEmail, router]);

  const isLight = theme === "light";

  return (
    <div
      className={`h-screen flex flex-col transition-colors duration-300 overflow-hidden ${
        isLight ? "bg-white text-slate-900" : "bg-slate-950 text-slate-100"
      }`}
    >
      {/* Top Navigation */}
      <Navbar />

      {/* Mobile / Tablet Responsive Tab Switcher Bar (< lg screens) */}
      <div
        className={`lg:hidden flex items-center justify-around border-b px-2 py-1.5 shrink-0 ${
          isLight ? "bg-slate-100/90 border-slate-200" : "bg-slate-900/90 border-slate-800"
        }`}
      >
        <button
          onClick={() => setMobileTab("docs")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mobileTab === "docs"
              ? isLight
                ? "bg-white text-blue-600 shadow-sm"
                : "bg-slate-800 text-blue-400 shadow-sm"
              : isLight
              ? "text-slate-600 hover:text-slate-900"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Files className="w-3.5 h-3.5" />
          <span>Documents ({documents.length})</span>
        </button>

        <button
          onClick={() => setMobileTab("pdf")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mobileTab === "pdf"
              ? isLight
                ? "bg-white text-blue-600 shadow-sm"
                : "bg-slate-800 text-blue-400 shadow-sm"
              : isLight
              ? "text-slate-600 hover:text-slate-900"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>PDF Viewer</span>
        </button>

        <button
          onClick={() => setMobileTab("chat")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mobileTab === "chat"
              ? isLight
                ? "bg-white text-blue-600 shadow-sm"
                : "bg-slate-800 text-blue-400 shadow-sm"
              : isLight
              ? "text-slate-600 hover:text-slate-900"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>AI Chat</span>
        </button>
      </div>

      {/* Main Split-Screen Workspace (Desktop: 3-pane, Mobile: selected tab) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Document Inventory */}
        <aside
          className={`w-full lg:w-80 border-r flex flex-col shrink-0 transition-colors duration-300 ${
            mobileTab === "docs" ? "flex" : "hidden lg:flex"
          } ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950 border-slate-800"}`}
        >
          <div
            className={`p-3 pb-2 flex items-center justify-between border-b ${
              isLight ? "border-slate-200" : "border-slate-800/80"
            }`}
          >
            <span
              className={`text-[11px] font-semibold tracking-wider uppercase ${
                isLight ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Your Documents ({documents.length})
            </span>
            <button
              onClick={() => {
                setActiveDocumentId(null);
                setMobileTab("pdf");
              }}
              title="Upload New Document"
              className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border transition-all cursor-pointer ${
                isLight
                  ? "bg-white hover:bg-slate-100 text-blue-600 border-slate-300 shadow-xs"
                  : "bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border-blue-500/30"
              }`}
            >
              <Plus className="w-3 h-3" />
              <span>Upload</span>
            </button>
          </div>
          <DocumentList />
        </aside>

        {/* Center Workspace: PDF Viewer */}
        <main
          className={`flex-1 overflow-hidden ${
            mobileTab === "pdf" ? "flex flex-col" : "hidden lg:flex lg:flex-col"
          }`}
        >
          <PdfViewer />
        </main>

        {/* Right Pane: AI Review & Conversational RAG Chat */}
        <aside
          className={`w-full lg:w-[420px] border-l flex flex-col shrink-0 transition-colors duration-300 ${
            mobileTab === "chat" ? "flex" : "hidden lg:flex"
          } ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950 border-slate-800"}`}
        >
          <ChatInterface />
        </aside>
      </div>
    </div>
  );
}

