import {create } from "zustand"
import { persist } from "zustand/middleware";
import { DocumentItem, ChatMessage, DocumentSummary } from "../types";

interface WorkspaceState {
  activeDocumentId: string | null;
  documents: DocumentItem[];
  chatHistory: Record<string, ChatMessage[]>;
  activePage: number;
  totalPages: number;
  isStreaming: boolean;
  selectedModel: string;

  setActiveDocumentId: (id: string | null) => void;
  setDocuments: (docs: DocumentItem[]) => void;
  updateDocumentStatus: (id: string, status: DocumentItem["status"]) => void;
  setDocumentSummary: (id: string, summary: DocumentSummary) => void;
  removeDocument: (id: string) => void;

  setActivePage: (page: number) => void;
  setTotalPages: (total: number) => void;

  setIsStreaming: (streaming: boolean) => void;
  setSelectedModel: (model: string) => void;
  setChatHistory: (docId: string, messages: ChatMessage[]) => void;
  addChatMessage: (docId: string, message: ChatMessage) => void;
  editChatMessage: (docId: string, messageId: string, newContent: string) => void;
  clearChatHistory: (docId: string) => void;
  updateLastAssistantMessageToken: (docId: string, token: string) => void;
  setLastAssistantCitations: (docId: string, citations: number[]) => void;
}
export const useWorkspaceStore = create<WorkspaceState>()(persist<WorkspaceState>((set) => ({

  activeDocumentId: null,
  documents: [],
  chatHistory: {},
  activePage: 1,
  totalPages: 1,
  isStreaming: false,
  selectedModel: "deepseek-v4-pro-free",

  setSelectedModel: (model) => set({ selectedModel: model }),

  clearChatHistory: (docId) =>
    set((state) => ({
      chatHistory: { ...state.chatHistory, [docId]: [] },
    })),

  editChatMessage: (docId, messageId, newContent) =>
    set((state) => {
      const current = state.chatHistory[docId] || [];
      const updated = current.map((msg) =>
        msg.id === messageId ? { ...msg, content: newContent } : msg
      );
      return {
        chatHistory: { ...state.chatHistory, [docId]: updated },
      };
    }),


  setActiveDocumentId: (id) => set({ activeDocumentId: id, activePage: 1 }),
  setDocuments: (docs) => set({ documents: docs }),
  
  updateDocumentStatus: (id, status) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === id ? { ...doc, status } : doc
      ),
    })),

  setDocumentSummary: (id, summary) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === id ? { ...doc, summary } : doc
      ),
    })),

  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((doc) => doc.id !== id),
      activeDocumentId: state.activeDocumentId === id ? null : state.activeDocumentId,
    })),

  setActivePage: (page) => set({ activePage: page }),
  setTotalPages: (total) => set({ totalPages: total }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  setChatHistory: (docId, messages) =>
    set((state) => {
      const seen = new Set<string>();
      const deduped = messages.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      return { chatHistory: { ...state.chatHistory, [docId]: deduped } };
    }),

  addChatMessage: (docId, message) =>
    set((state) => {
      const current = state.chatHistory[docId] || [];
      if (current.some((m) => m.id === message.id)) return state;
      return {
        chatHistory: { ...state.chatHistory, [docId]: [...current, message] },
      };
    }),

  updateLastAssistantMessageToken: (docId, token) =>
    set((state) => {
      const current = state.chatHistory[docId] || [];
      if (current.length === 0) return state;

      const lastIndex = current.length - 1;
      const lastMsg = current[lastIndex];

      if (lastMsg.role !== "assistant") return state;

      const updatedMsg = { ...lastMsg, content: lastMsg.content + token };
      const updatedList = [...current.slice(0, lastIndex), updatedMsg];

      return {
        chatHistory: { ...state.chatHistory, [docId]: updatedList },
      };
    }),

  setLastAssistantCitations: (docId, citations) =>
    set((state) => {
      const current = state.chatHistory[docId] || [];
      if (current.length === 0) return state;

      const lastIndex = current.length - 1;
      const lastMsg = current[lastIndex];

      if (lastMsg.role !== "assistant") return state;

      const updatedMsg = { ...lastMsg, citations };
      const updatedList = [...current.slice(0, lastIndex), updatedMsg];

      return {
        chatHistory: { ...state.chatHistory, [docId]: updatedList },
      };
    }),
}), {
  name: "workspace-storage",
  partialize: (state) => ({
    chatHistory: state.chatHistory,
    documents: state.documents,
    activeDocumentId: state.activeDocumentId,
  }),
}));

