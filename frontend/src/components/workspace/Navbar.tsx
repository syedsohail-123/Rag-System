"use client";

import { FileText, LogOut, Shield } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/lib/store/useWorkspaceStore";


export function Navbar() {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await apiFetch("/auth/signout", { method: "POST" });
    } catch (err) {
      console.error("Signout error ", err);
      // Fallback
    } finally {
      useWorkspaceStore.setState({ activeDocumentId: null, documents: [], chatHistory: {} })
      localStorage.clear()
      router.push("/login");
    }
  };


  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
          <FileText className="w-5 h-5" />
        </div>
        <span className="font-semibold text-slate-100 tracking-tight">
          AI PDF Assistant <span className="text-xs font-normal text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">RAG</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          <Shield className="w-3.5 h-3.5" />
          <span>Multi-Tenant Auth</span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2.5 py-1 rounded-md hover:bg-slate-800"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}
