"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, BookOpen, Loader2, Plus, Edit2, Check, X, Cpu, Pin, FileText, Sparkles, ChevronDown, MessageSquare, Trash2 } from "lucide-react";

import { useWorkspaceStore } from "@/lib/store/useWorkspaceStore";
import { streamChatQuery } from "@/lib/api";
import { DocumentReview } from "./DocumentReview";

function ExpandableMessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > 250 || content.split("\n").length > 5;

  return (
    <div className="space-y-1.5">
      <div
        className={`prose prose-invert leading-relaxed whitespace-pre-wrap font-sans text-[13.5px] ${
          isUser ? "text-white font-normal" : "text-slate-200"
        } ${!expanded && isLong ? "line-clamp-5 overflow-hidden" : ""}`}
      >
        {content}
      </div>

      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] text-blue-200 hover:text-white font-medium pt-1 transition-colors outline-none cursor-pointer"
        >
          <span>{expanded ? "Show less" : "Show more"}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </button>
      )}
    </div>
  );
}

export function ChatInterface() {
  const [inputQuery, setInputQuery] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    activeDocumentId,
    documents,
    chatHistory,
    isStreaming,
    setIsStreaming,
    selectedModel,
    setSelectedModel,
    addChatMessage,
    editChatMessage,
    clearChatHistory,
    updateLastAssistantMessageToken,
    setLastAssistantCitations,
    setActivePage,
  } = useWorkspaceStore();

  const activeDoc = documents.find((doc) => doc.id === activeDocumentId);
  const currentMessages = activeDocumentId ? chatHistory[activeDocumentId] || [] : [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, isStreaming]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || !activeDocumentId || isStreaming) return;

    if (!queryText) setInputQuery("");

    // 1. Add User Message
    const userMessageId = `user-${crypto.randomUUID()}`;
    addChatMessage(activeDocumentId, {
      id: userMessageId,
      role: "user",
      content: textToSend,
    });

    // 2. Add Empty Assistant Placeholder
    const assistantMessageId = `assistant-${crypto.randomUUID()}`;
    addChatMessage(activeDocumentId, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
    });

    setIsStreaming(true);

    // 3. Initiate SSE Stream
    await streamChatQuery({
      documentId: activeDocumentId,
      query: textToSend,
      model: selectedModel,
      onToken: (token) => {
        updateLastAssistantMessageToken(activeDocumentId, token);
      },
      onCitations: (citations) => {
        setLastAssistantCitations(activeDocumentId, citations);
      },
      onError: () => {
        updateLastAssistantMessageToken(
          activeDocumentId,
          "\n[Error: Unable to complete response streaming.]"
        );
        setIsStreaming(false);
      },
      onComplete: () => {
        setIsStreaming(false);
      },
    });
  };

  const handleSaveEdit = (messageId: string) => {
    if (!activeDocumentId || !editingText.trim() || isStreaming) return;
    editChatMessage(activeDocumentId, messageId, editingText);
    setEditingMessageId(null);
    handleSend(editingText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeDoc) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-slate-500 text-xs bg-slate-950">
        Select or upload a document to start querying.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100">
      {/* AI Chat 7 Top Header & Model Selector */}
      <div className="h-12 border-b border-slate-800/80 px-3.5 flex items-center justify-between text-xs bg-slate-900/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={`p-1 rounded-md border ${
              selectedModel.includes("qwen")
                ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
            }`}
          >
            {selectedModel.includes("qwen") ? (
              <img src="/qwen-logo.png" alt="Qwen Logo" className="w-4 h-4 object-contain" />
            ) : (
              <img src="/deepseek-logo.png" alt="DeepSeek Logo" className="w-4 h-4 object-contain" />
            )}
          </div>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-slate-950 text-[11px] font-medium text-slate-200 px-2 py-1 rounded-md border border-slate-800 outline-none cursor-pointer hover:border-slate-700"
          >
            <option value="deepseek-v4-pro-free" className="bg-slate-900 text-slate-100">
              DeepSeek-V4 Pro Free (Reasoning)
            </option>
            <option value="qwen-2.5-max-free" className="bg-slate-900 text-slate-100">
              Qwen 3.8B Free (Long-Context)
            </option>
          </select>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50 font-mono whitespace-nowrap">
            <MessageSquare className="w-2.5 h-2.5 text-slate-400 shrink-0" />
            {currentMessages.length > 0
              ? `${currentMessages.length} msg${currentMessages.length > 1 ? "s" : ""}`
              : "No history"}
          </span>

          {currentMessages.length > 0 && (
            <button
              onClick={() => activeDocumentId && clearChatHistory(activeDocumentId)}
              title="Clear Chat History"
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors shrink-0"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={() => activeDocumentId && clearChatHistory(activeDocumentId)}
            title="Start a new chat session"
            className="flex items-center gap-1 text-[10px] font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 px-2 py-1 rounded-md border border-slate-700/60 transition-all whitespace-nowrap shrink-0"
          >
            <Plus className="w-3 h-3 text-blue-400 shrink-0" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* AI Chat 7 Pinned Context Source Banner */}
      <div className="px-3.5 py-2 bg-slate-900/40 border-b border-slate-800/60 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] text-slate-400 shrink-0 font-medium">Pinned Source:</span>
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 truncate">
            <FileText className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="text-[11px] text-slate-200 font-medium truncate max-w-[180px]">
              {activeDoc.filename}
            </span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
          Active Evidence Mapping
        </span>
      </div>

      {/* Messages Feed Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Executive Document Review */}
        <DocumentReview
          summary={activeDoc.summary}
          onSelectStarterQuestion={(q) => handleSend(q)}
        />

        {currentMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 text-xs ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <div
                className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700/80 flex items-center justify-center shrink-0 shadow-lg mt-0.5 overflow-hidden p-1"
                title={selectedModel.includes("qwen") ? "Qwen 2.5 Model" : "DeepSeek-V4 Model"}
              >
                {selectedModel.includes("qwen") ? (
                  <img src="/qwen-logo.png" alt="Qwen Logo" className="w-full h-full object-contain" />
                ) : (
                  <img src="/deepseek-logo.png" alt="DeepSeek Logo" className="w-4 h-4 object-contain" />
                )}
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 group relative transition-all shadow-md ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none border border-blue-400/20 shadow-blue-950/30"
                  : "bg-slate-900/90 border border-slate-800/90 text-slate-100 rounded-bl-none shadow-md"
              }`}
            >
              {/* Inline User Message Edit Box */}
              {editingMessageId === msg.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 outline-none resize-none focus:border-blue-400 font-mono"
                    rows={3}
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => setEditingMessageId(null)}
                      className="p-1 rounded-md bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleSaveEdit(msg.id)}
                      className="p-1 rounded-md bg-blue-500 text-white hover:bg-blue-400 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <ExpandableMessageContent
                    content={msg.content || (isStreaming ? "Generating response..." : "")}
                    isUser={msg.role === "user"}
                  />

                  {/* Hover Edit Trigger */}
                  {msg.role === "user" && !isStreaming && (
                    <button
                      onClick={() => {
                        setEditingMessageId(msg.id);
                        setEditingText(msg.content);
                      }}
                      title="Edit message"
                      className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 p-1 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-full shadow-lg transition-all"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}

              {/* Per-Message Evidence & Page Citation Mapping */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-400 flex items-center gap-1 font-medium text-[10px]">
                      <BookOpen className="w-3 h-3 text-blue-400" /> Evidence Mapped:
                    </span>
                    {msg.citations.map((pg) => (
                      <button
                        key={pg}
                        onClick={() => setActivePage(pg)}
                        className="inline-flex items-center gap-1 text-[10px] font-mono bg-blue-500/10 hover:bg-blue-500/25 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30 transition-colors"
                      >
                        <FileText className="w-2.5 h-2.5" />
                        Page {pg}
                      </button>
                    ))}
                  </div>

                  <span className="text-[9px] font-mono text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-amber-400" /> Verified Context
                  </span>
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 border border-slate-700 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/60 shrink-0">
        <div className="relative flex items-center">
          <textarea
            disabled={isStreaming}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? "AI evidence stream active..."
                : `Ask ${selectedModel}... (Enter to send, Shift+Enter for newline)`
            }
            rows={2}
            className="w-full resize-none bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none pr-10 disabled:opacity-50"
          />

          <button
            disabled={isStreaming || !inputQuery.trim()}
            onClick={() => handleSend()}
            className="absolute right-2.5 p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 transition-colors"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


