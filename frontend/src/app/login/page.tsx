"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";
import { apiFetch } from "@/lib/api";

type AuthMode = "signin" | "signup";

export default function LoginPage() {
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (authMode === "signup") {
        await apiFetch("/auth/signup", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        router.push("/");
      } else {
        await apiFetch("/auth/signin", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        router.push("/");
      }

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
            <FileText className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">AI PDF Document Assistant</h1>
          <p className="text-xs text-slate-400">
            {authMode === "signup"
              ? "Create an account to manage documents"
              : "Sign in to access your document workspace"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1 block">Email Address</label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">Password</label>
            </div>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg pl-9 pr-10 py-2 text-xs text-slate-100 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <span>
              {loading
                ? "Processing..."
                : authMode === "signup"
                ? "Sign Up"
                : "Sign In"}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="text-center text-xs text-slate-400">
          {authMode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => {
                  setAuthMode("signin");
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-blue-400 hover:underline font-medium"
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => {
                  setAuthMode("signup");
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-blue-400 hover:underline font-medium"
              >
                Register
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

