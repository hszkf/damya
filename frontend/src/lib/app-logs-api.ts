const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface AppLogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  requestId?: string;
  userId?: number;
  username?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: { name: string; message: string; stack?: string; code?: string };
  metadata?: Record<string, unknown>;
}

export interface AppLogsResponse {
  success: boolean;
  data: AppLogEntry[];
  count: number;
  stats: { total: number; byLevel: Record<string, number> };
}

export interface HealthSummary {
  redshift: { connected: boolean; error?: string; status: string; [key: string]: unknown };
  storage: { connected: boolean; error?: string; status: string; [key: string]: unknown };
  stats: { total: number; byLevel: Record<string, number> };
  uptime: number;
}

export async function fetchAppLogs(level?: string, limit?: number): Promise<AppLogsResponse> {
  const params = new URLSearchParams();
  if (level) params.set("level", level);
  if (limit) params.set("limit", String(limit));
  const response = await fetch(`${API_BASE_URL}/app-logs?${params}`);
  if (!response.ok) throw new Error(`Failed to fetch logs: ${response.status}`);
  return response.json();
}

export async function clearAppLogs(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/app-logs`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to clear logs");
}

export async function fetchHealthSummary(): Promise<HealthSummary> {
  const response = await fetch(`${API_BASE_URL}/app-logs/health`);
  if (!response.ok) throw new Error("Failed to fetch health");
  return response.json();
}

export function createLogStream(
  onLog: (entry: AppLogEntry) => void,
  onError?: (error: Error) => void,
): () => void {
  const eventSource = new EventSource(`${API_BASE_URL}/app-logs/stream`);
  eventSource.onmessage = (event) => {
    if (event.data && event.data !== "__heartbeat__") {
      try {
        onLog(JSON.parse(event.data));
      } catch {}
    }
  };
  eventSource.onerror = () => {
    onError?.(new Error("SSE connection lost"));
  };
  return () => eventSource.close();
}
