"use client";

import { useEffect, useState } from "react";
import { FileText, LogOut, Sparkles, SlidersHorizontal } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/lib/store/useWorkspaceStore";

export function Navbar() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>("");
  const [isStrictMode, setIsStrictMode] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedEmail = localStorage.getItem("user_email") || "";
      setUserEmail(storedEmail);
    }
  }, []);

  const handleSignOut = async () => {
    try {
      await apiFetch("/auth/signout", { method: "POST" });
    } catch (err) {
      console.error("Signout error ", err);
    } finally {
      useWorkspaceStore.setState({ activeDocumentId: null, documents: [], chatHistory: {} });
      localStorage.clear();
      router.push("/login");
    }
  };

  const initialLetter = userEmail ? userEmail.charAt(0).toUpperCase() : "U";

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-4 flex items-center justify-between shrink-0">
      {/* Brand Logo */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
          <FileText className="w-5 h-5" />
        </div>
        <span className="font-semibold text-slate-100 tracking-tight">
          AI PDF Assistant <span className="text-xs font-normal text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">RAG</span>
        </span>
      </div>

      {/* Right Controls: RAG Toggle Switch, User Initial Avatar, Sign Out */}
      <div className="flex items-center gap-4">
        {/* Interactive RAG Mode Toggle Switch */}
        <div className="flex items-center gap-2 bg-slate-950/70 border border-slate-800 px-3 py-1 rounded-full">
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Sparkles className={`w-3.5 h-3.5 ${isStrictMode ? "text-blue-400" : "text-purple-400"}`} />
            <span className="text-[11px] font-medium hidden sm:inline">
              {isStrictMode ? "Strict RAG" : "Smart Assist"}
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isStrictMode}
            onClick={() => setIsStrictMode(!isStrictMode)}
            title={`Toggle mode: ${isStrictMode ? "Strict Document Context" : "Smart Augmented Generation"}`}
            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors focus:outline-none ${
              isStrictMode ? "bg-blue-600" : "bg-purple-600"
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                isStrictMode ? "translate-x-0" : "translate-x-4"
              }`}
            />
          </button>
        </div>

        {/* User Initial Avatar */}
        <div
          title={userEmail ? `Signed in as: ${userEmail}` : "User Profile"}
          className="flex items-center gap-2 cursor-default"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shadow-md ring-2 ring-blue-500/30">
            {initialLetter}
          </div>
          {userEmail && (
            <span className="text-xs text-slate-300 font-medium hidden md:inline truncate max-w-[120px]">
              {userEmail.split("@")[0]}
            </span>
          )}
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2.5 py-1 rounded-md hover:bg-slate-800"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}

