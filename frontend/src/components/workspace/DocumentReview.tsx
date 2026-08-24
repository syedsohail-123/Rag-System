"use client";

import { Sparkles, HelpCircle, BookOpen } from "lucide-react";
import { DocumentSummary } from "@/lib/types";
import { useWorkspaceStore } from "@/lib/store/useWorkspaceStore";

interface DocumentReviewProps {
  summary?: DocumentSummary;
  onSelectStarterQuestion: (q: string) => void;
}

export function DocumentReview({ summary, onSelectStarterQuestion }: DocumentReviewProps) {
  if (!summary) {
    return (
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 text-xs text-slate-500 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
        <span>Automated AI review (summary & prompt starters) will appear here once ingested.</span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3 text-xs mb-4">
      <div className="flex items-center gap-2 text-blue-400 font-medium">
        <Sparkles className="w-4 h-4" />
        <span>Automated Executive Review</span>
      </div>

      {/* 3-Bullet Executive Summary */}
      {summary.bullets && summary.bullets.length > 0 && (
        <ul className="space-y-1.5 list-disc list-inside text-slate-300">
          {summary.bullets.map((bullet, idx) => (
            <li key={idx} className="leading-relaxed">
              {bullet}
            </li>
          ))}
        </ul>
      )}

      {/* Key Topics */}
      {summary.key_topics && summary.key_topics.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <BookOpen className="w-3.5 h-3.5 text-slate-500" />
          {summary.key_topics.map((topic, idx) => (
            <span
              key={idx}
              className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {/* Starter Questions */}
      {summary.starter_questions && summary.starter_questions.length > 0 && (
        <div className="pt-2 border-t border-slate-800/80">
          <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mb-2">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>Suggested Starter Questions:</span>
          </p>
          <div className="flex flex-col gap-1.5">
            {summary.starter_questions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => onSelectStarterQuestion(q)}
                className="text-left text-xs text-blue-300 hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 p-2 rounded-lg border border-blue-500/20 transition-colors"
              >
                &quot;{q}&quot;
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
