/**
 * Query History Manager
 *
 * Stores executed queries in localStorage with a maximum of 20 entries per database type.
 */

export type DatabaseType = "redshift";

export interface QueryHistoryEntry {
  id: string;
  query: string;
  database: DatabaseType;
  timestamp: number;
  executionTime?: number;
  rowCount?: number;
  success: boolean;
}

const MAX_HISTORY_SIZE = 20;
const STORAGE_KEY = "sql-query-history";

// Generate unique ID
const generateId = () => `qh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Get all history from localStorage
export function getAllHistory(): QueryHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as QueryHistoryEntry[];
  } catch {
    return [];
  }
}

// Get history for a specific database type
export function getHistory(database: DatabaseType): QueryHistoryEntry[] {
  return getAllHistory()
    .filter((entry) => entry.database === database)
    .sort((a, b) => b.timestamp - a.timestamp);
}

// Add a query to history
export function addToHistory(
  database: DatabaseType,
  query: string,
  success: boolean,
  executionTime?: number,
  rowCount?: number
): QueryHistoryEntry {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("Query cannot be empty");
  }

  const allHistory = getAllHistory();

  // Check if this exact query already exists for this database (avoid duplicates)
  const existingIndex = allHistory.findIndex(
    (entry) => entry.database === database && entry.query.trim() === trimmedQuery
  );

  // If exists, remove it (we'll add it back at the top)
  if (existingIndex !== -1) {
    allHistory.splice(existingIndex, 1);
  }

  const newEntry: QueryHistoryEntry = {
    id: generateId(),
    query: trimmedQuery,
    database,
    timestamp: Date.now(),
    executionTime,
    rowCount,
    success,
  };

  // Add to beginning
  allHistory.unshift(newEntry);

  // Keep only MAX_HISTORY_SIZE entries per database
  const redshiftHistory = allHistory.filter((e) => e.database === "redshift");

  const trimmedHistory = [
    ...redshiftHistory.slice(0, MAX_HISTORY_SIZE),
  ];

  // Save to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
  } catch {
    // Storage might be full, try to save anyway
    console.warn("Failed to save query history to localStorage");
  }

  return newEntry;
}

// Remove a specific entry from history
export function removeFromHistory(id: string): void {
  const allHistory = getAllHistory();
  const filtered = allHistory.filter((entry) => entry.id !== id);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    console.warn("Failed to update query history in localStorage");
  }
}

// Clear all history for a database type
export function clearHistory(database: DatabaseType): void {
  const allHistory = getAllHistory();
  const filtered = allHistory.filter((entry) => entry.database !== database);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    console.warn("Failed to clear query history in localStorage");
  }
}

// Clear all history
export function clearAllHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    console.warn("Failed to clear all query history from localStorage");
  }
}

// Format timestamp for display
export function formatHistoryTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  // Less than 1 minute
  if (diff < 60 * 1000) {
    return "Just now";
  }

  // Less than 1 hour
  if (diff < 60 * 60 * 1000) {
    const mins = Math.floor(diff / (60 * 1000));
    return `${mins}m ago`;
  }

  // Less than 24 hours
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}h ago`;
  }

  // Less than 7 days
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}d ago`;
  }

  // Otherwise show date
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
