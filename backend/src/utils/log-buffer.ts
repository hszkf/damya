import type { LogEntry, LogLevel } from './logger';

const MAX_BUFFER_SIZE = 1000;

const buffer: LogEntry[] = [];
const subscribers = new Set<(entry: LogEntry) => void>();

export function addToBuffer(entry: LogEntry): void {
  if (buffer.length >= MAX_BUFFER_SIZE) {
    buffer.shift();
  }
  buffer.push(entry);
  for (const cb of subscribers) {
    try {
      cb(entry);
    } catch {}
  }
}

export function getLogs(level?: LogLevel, limit?: number): LogEntry[] {
  let logs = buffer;
  if (level) {
    logs = logs.filter((e) => e.level === level);
  }
  const n = limit ?? 200;
  return logs.slice(-n);
}

export function clearLogs(): void {
  buffer.length = 0;
}

export function subscribe(cb: (entry: LogEntry) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

export function getLogStats(): { total: number; byLevel: Record<string, number> } {
  const byLevel: Record<string, number> = { debug: 0, info: 0, warn: 0, error: 0 };
  for (const entry of buffer) {
    byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
  }
  return { total: buffer.length, byLevel };
}
