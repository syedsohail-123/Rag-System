"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/workspace/Navbar";
import { DocumentUploader } from "@/components/workspace/DocumentUploader";
import { DocumentList } from "@/components/workspace/DocumentList";
import { ChatInterface } from "@/components/workspace/ChatInterface";
import { useWorkspaceStore } from "@/lib/store/useWorkspaceStore";
import { apiFetch } from "@/lib/api";


const PdfViewer = dynamic(
  () => import("@/components/workspace/PdfViewer").then((mod) => mod.PdfViewer),
  { ssr: false }
);

export default function WorkspacePage() {
  const { setDocuments, documents, theme, setUserEmail } = useWorkspaceStore();
  const router = useRouter();

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
        // Unauthenticated -> Redirect to authentication login page
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

      {/* Main Split-Screen Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Document Inventory & History */}
        <aside
          className={`w-80 border-r flex flex-col shrink-0 transition-colors duration-300 ${
            isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950 border-slate-800"
          }`}
        >
          <div
            className={`p-3 pb-0 text-[11px] font-semibold tracking-wider uppercase ${
              isLight ? "text-slate-500" : "text-slate-400"
            }`}
          >
            Your Documents
          </div>
          <DocumentList />
        </aside>

        {/* Center Workspace: PDF Viewer */}
        <main className="flex-1 overflow-hidden">
          <PdfViewer />
        </main>

        {/* Right Pane: AI Review & Conversational RAG Chat */}
        <aside
          className={`w-[420px] border-l flex flex-col shrink-0 transition-colors duration-300 ${
            isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950 border-slate-800"
          }`}
        >
          <ChatInterface />
        </aside>
      </div>
    </div>
  );
}
