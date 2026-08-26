"use client";

import { useState, useRef, useEffect } from "react";
import { FileText, LogOut, Sun, Moon, Sparkles, Check, Settings, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/lib/store/useWorkspaceStore";

export function Navbar() {
  const router = useRouter();
  const { theme, setTheme, toggleTheme, userEmail } = useWorkspaceStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  const isLight = theme === "light";
  const { activeDocumentId, setActiveDocumentId } = useWorkspaceStore();

  // Extract clean first name from email (e.g. "ahmedsyedsohail776@gmail.com" -> "Ahmed", "syed.sohail@..." -> "Syed")
  const getFirstName = (email: string) => {
    if (!email) return "User";
    const raw = email.split("@")[0]; // e.g. "ahmedsyedsohail776"
    const noNumbers = raw.replace(/[0-9_.-]/g, "");
    if (!noNumbers) return "User";

    const commonPrefixes = [
      "ahmed", "syed", "sohail", "mohammed", "mohd", "ali", "khan",
      "john", "alex", "david", "michael", "daniel", "sarah", "emma",
      "rahul", "rohit", "priya", "amit", "raj", "anita", "vikram"
    ];

    const lower = noNumbers.toLowerCase();
    for (const name of commonPrefixes) {
      if (lower.startsWith(name)) {
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    }

    // Fallback: take up to 6 characters if very long
    const clean = noNumbers.length > 7 ? noNumbers.slice(0, 5) : noNumbers;
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  };

  const firstName = getFirstName(userEmail);
  const initialLetter = firstName.charAt(0).toUpperCase();

  return (
    <header
      className={`h-14 border-b px-4 flex items-center justify-between shrink-0 transition-colors duration-300 relative z-50 ${
        isLight
          ? "bg-white/95 border-slate-200 text-slate-900 shadow-sm"
          : "bg-slate-900/90 border-slate-800 text-slate-100 backdrop-blur"
      }`}
    >
      {/* Brand Logo */}
      <div className="flex items-center gap-3">
        <div
          onClick={() => setActiveDocumentId(null)}
          className="flex items-center gap-2 cursor-pointer group"
          title="Return to Upload Home"
        >
          <div className="p-1.5 bg-blue-600/20 text-blue-500 rounded-lg border border-blue-500/30 group-hover:bg-blue-600/30 transition-colors">
            <FileText className="w-5 h-5" />
          </div>
          <span className="font-semibold tracking-tight">
            AI PDF Assistant{" "}
            <span className="text-xs font-normal text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              RAG
            </span>
          </span>
        </div>
      </div>

      {/* Right Controls: Settings Menu & User Avatar */}
      <div className="flex items-center gap-3 relative" ref={settingsRef}>
        {/* User Initial Avatar & Settings Trigger */}
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          title="Account Settings"
          className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all ${
            isLight
              ? "bg-slate-100/80 hover:bg-slate-200/80 border-slate-200"
              : "bg-slate-950/80 hover:bg-slate-800/80 border-slate-800"
          }`}
        >
          {/* Circular Initial Avatar */}
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 text-white font-extrabold text-xs flex items-center justify-center shadow-md ring-2 ring-blue-500/30 shrink-0">
            {initialLetter}
          </div>

          <span
            className={`text-xs font-semibold hidden md:inline truncate max-w-[120px] ${
              isLight ? "text-slate-800" : "text-slate-200"
            }`}
          >
            {firstName}
          </span>

          <Settings className={`w-3.5 h-3.5 ${isLight ? "text-slate-500" : "text-slate-400"}`} />
        </button>

        {/* Dropdown Menu */}
        {isSettingsOpen && (
          <div
            className={`absolute right-0 top-12 w-64 rounded-2xl shadow-2xl border p-2 space-y-2 animate-in fade-in-0 zoom-in-95 duration-150 ${
              isLight
                ? "bg-white border-slate-200 text-slate-900 shadow-slate-200/60"
                : "bg-slate-900 border-slate-800 text-slate-100 shadow-black/60"
            }`}
          >
            {/* User Profile Header */}
            <div
              className={`p-3 rounded-xl flex items-center gap-3 border ${
                isLight ? "bg-slate-50 border-slate-200/60" : "bg-slate-950/60 border-slate-800/60"
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md shrink-0 ring-2 ring-blue-500/20">
                {initialLetter}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate">
                  {userEmail ? userEmail.split("@")[0] : "Authenticated User"}
                </div>
                <div className={`text-[10px] truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  {userEmail || "Multi-tenant RAG"}
                </div>
              </div>
            </div>

            {/* Settings Actions: 2-Color Theme Switcher */}
            <div className="px-2 py-1 space-y-1">
              <div
                className={`text-[10px] font-semibold tracking-wider uppercase px-1 ${
                  isLight ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Theme
              </div>

              {/* Theme Toggle Option */}
              <div
                onClick={toggleTheme}
                className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                  isLight ? "hover:bg-slate-100" : "hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  {isLight ? (
                    <Sun className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Moon className="w-4 h-4 text-blue-400" />
                  )}
                  <span className="font-medium">{isLight ? "White Theme" : "Black Theme"}</span>
                </div>

                <div
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                    isLight ? "bg-amber-500" : "bg-blue-600"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      isLight ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className={`h-px my-1 ${isLight ? "bg-slate-200" : "bg-slate-800"}`} />

            {/* Sign Out Option */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}


