/**
 * RAG API client for document-to-chat with streaming support.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

// Types
export interface RAGSession {
  session_id: string;
  created_at: string;
}

export interface RAGDocument {
  id: string;
  filename: string;
  content_type: string;
  file_size: number;
  chunk_count: number;
  status: "processing" | "ready" | "error";
  error_message?: string;
  created_at: string;
}

export interface DocumentUploadResponse {
  document_id: string;
  filename: string;
  chunks_created: number;
  processing_time_ms: number;
  status: "processing" | "ready" | "error";
  error?: string;
}

export interface Citation {
  document_id: string;
  document_name: string;
  chunk_index: number;
  relevance_score: number;
  excerpt: string;
}

export interface RAGQueryResponse {
  answer: string;
  citations: Citation[];
  session_id: string;
  model: string;
  timestamp: string;
}

export interface RAGHealthStatus {
  status: "ready" | "not_ready" | "error";
  components: Record<string, unknown>;
}

export interface RAGStreamCallbacks {
  onCitation: (citation: Citation) => void;
  onChunk: (content: string) => void;
  onDone: (model?: string) => void;
  onError: (error: string) => void;
}

/**
 * Create a new RAG session.
 */
export async function createRAGSession(): Promise<RAGSession> {
  const response = await fetch(`${API_BASE_URL}/rag/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create session: ${response.status}`);
  }

  return await response.json();
}

/**
 * Upload a document for RAG processing.
 */
export async function uploadDocument(
  sessionId: string,
  file: File
): Promise<DocumentUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/rag/session/${sessionId}/documents`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Upload failed: ${response.status}`);
  }

  return await response.json();
}

/**
 * List all documents for a session.
 */
export async function listDocuments(sessionId: string): Promise<RAGDocument[]> {
  const response = await fetch(`${API_BASE_URL}/rag/session/${sessionId}/documents`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to list documents: ${response.status}`);
  }

  const data = await response.json();
  return data.documents;
}

/**
 * Delete a document from a session.
 */
export async function deleteDocument(
  sessionId: string,
  documentId: string
): Promise<boolean> {
  const response = await fetch(
    `${API_BASE_URL}/rag/session/${sessionId}/documents/${documentId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Delete failed: ${response.status}`);
  }

  const data = await response.json();
  return data.success;
}

/**
 * Delete an entire RAG session.
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/rag/session/${sessionId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Delete session failed: ${response.status}`);
  }

  const data = await response.json();
  return data.success;
}

/**
 * Query documents with RAG (non-streaming).
 */
export async function queryRAG(
  question: string,
  sessionId: string,
  model?: string
): Promise<RAGQueryResponse> {
  const response = await fetch(`${API_BASE_URL}/rag/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      session_id: sessionId,
      model,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Query failed: ${response.status}`);
  }

  return await response.json();
}

/**
 * Query documents with RAG (streaming via SSE).
 *
 * @param question - User question
 * @param sessionId - RAG session ID
 * @param callbacks - Callback functions for handling stream events
 * @param model - Optional model override
 * @param signal - Optional AbortSignal for cancellation
 * @param userId - Optional user ID for memory personalisation
 */
export async function queryRAGStream(
  question: string,
  sessionId: string,
  callbacks: RAGStreamCallbacks,
  model?: string,
  signal?: AbortSignal,
  userId?: string
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/rag/query/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        question,
        session_id: sessionId,
        model,
        user_id: userId || "default",
      }),
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      callbacks.onError(errorData.detail || `Query failed: ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError("Response body is not readable");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events from buffer
      const lines = buffer.split("\n");

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case "citation":
                if (event.citation) {
                  callbacks.onCitation(event.citation);
                }
                break;

              case "chunk":
                if (event.content) {
                  callbacks.onChunk(event.content);
                }
                break;

              case "done":
                callbacks.onDone(event.model);
                break;

              case "error":
                callbacks.onError(event.error || "Unknown streaming error");
                break;
            }
          } catch (parseError) {
            console.warn("Failed to parse SSE event:", data);
          }
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.startsWith("data: ")) {
      const data = buffer.slice(6).trim();
      if (data) {
        try {
          const event = JSON.parse(data);
          if (event.type === "done") {
            callbacks.onDone(event.model);
          } else if (event.type === "error") {
            callbacks.onError(event.error || "Unknown streaming error");
          }
        } catch {
          // Ignore parse errors for incomplete data
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      // Request was cancelled by user
      callbacks.onDone();
      return;
    }

    callbacks.onError(
      error instanceof Error ? error.message : "Stream connection failed"
    );
  }
}

/**
 * Check RAG service health.
 */
export async function checkRAGHealth(): Promise<RAGHealthStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/rag/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        status: "error",
        components: { error: `Health check failed: ${response.status}` },
      };
    }

    return await response.json();
  } catch (error) {
    return {
      status: "error",
      components: {
        error: error instanceof Error ? error.message : "Connection failed",
      },
    };
  }
}

/**
 * Format file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get supported file types for RAG upload.
 */
export function getSupportedFileTypes(): string[] {
  return [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
    "application/json",
    "text/markdown",
  ];
}

/**
 * Get supported file extensions for RAG upload.
 */
export function getSupportedExtensions(): string[] {
  return [".pdf", ".docx", ".txt", ".csv", ".json", ".md", ".sql"];
}

/**
 * Check if a file type is supported for RAG upload.
 */
export function isFileTypeSupported(file: File): boolean {
  const supportedTypes = getSupportedFileTypes();
  const supportedExtensions = getSupportedExtensions();

  // Check by MIME type
  if (supportedTypes.includes(file.type)) {
    return true;
  }

  // Check by extension
  const fileName = file.name.toLowerCase();
  return supportedExtensions.some((ext) => fileName.endsWith(ext));
}
