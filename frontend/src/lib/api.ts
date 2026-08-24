const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "An API error occurred");
  }

  return response.json();
}

export interface StreamChatParams {
  documentId: string;
  query: string;
  model: string;
  onToken: (token: string) => void;
  onCitations: (citations: number[]) => void;
  onError: (err: unknown) => void;
  onComplete: () => void;
}

export async function streamChatQuery({
  documentId,
  query,
  model,
  onToken,
  onCitations,
  onError,
  onComplete,
}: StreamChatParams) {
  try {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId, query, model }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No response body available for SSE streaming.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const line = part.trim();
        if (line.startsWith("data: ")) {
          const rawJson = line.replace(/^data:\s*/, "");
          try {
            const data = JSON.parse(rawJson);
            if (data.token) {
              onToken(data.token);
            }
            if (data.citations) {
              onCitations(data.citations);
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
    onComplete();
  } catch (err) {
    onError(err);
  }
}
