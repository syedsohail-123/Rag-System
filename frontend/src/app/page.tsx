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
  const { setDocuments, documents } = useWorkspaceStore();
  const router = useRouter();

  useEffect(() => {
    // Verify session & rehydrate documents on dashboard mount
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
  }, [setDocuments, router]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Split-Screen Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Document Inventory & History */}
        <aside className="w-80 border-r border-slate-800 flex flex-col bg-slate-950 shrink-0">
          <div className="p-3 pb-0 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Your Documents
          </div>
          <DocumentList />
        </aside>


        {/* Center Workspace: PDF Viewer */}
        <main className="flex-1 overflow-hidden">
          <PdfViewer />
        </main>

        {/* Right Pane: AI Review & Conversational RAG Chat */}
        <aside className="w-[420px] border-l border-slate-800 flex flex-col bg-slate-950 shrink-0">
          <ChatInterface />
        </aside>
      </div>
    </div>
  );
}
