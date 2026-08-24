export interface User {
  id: string;
  email: string;
}

export type DocumentStatus = "Uploaded" | "Parsing" | "Chunking" | "Embedding" | "Ready";

export interface DocumentSummary {
  bullets: string[];
  key_topics: string[];
  starter_questions: string[];
}

export interface DocumentItem {
  id: string;
  user_id: string;
  filename: string;
  file_url?: string;
  status: DocumentStatus;
  summary?: DocumentSummary;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: number[];
  created_at?: string;
}
