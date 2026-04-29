/**
 * TanStack Query client configuration.
 * Provides data fetching, caching, and synchronization.
 */

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: how long data is considered fresh
      staleTime: 1000 * 30, // 30 seconds
      // Cache time: how long to keep data in cache after it becomes inactive
      gcTime: 1000 * 60 * 5, // 5 minutes (previously cacheTime)
      // Retry configuration
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus
      refetchOnWindowFocus: true,
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

// Query keys for type-safe queries
export const queryKeys = {
  // Jobs
  jobs: {
    all: ["jobs"] as const,
    list: (filters?: { author?: string; job_type?: string; is_active?: boolean }) =>
      ["jobs", "list", filters] as const,
    detail: (id: string) => ["jobs", "detail", id] as const,
    executions: (jobId: string) => ["jobs", "executions", jobId] as const,
    execution: (executionId: string) => ["jobs", "execution", executionId] as const,
    stats: () => ["jobs", "stats"] as const,
    schedulerStatus: () => ["jobs", "scheduler", "status"] as const,
    cronPresets: () => ["jobs", "scheduler", "cron-presets"] as const,
    registry: () => ["jobs", "registry"] as const,
  },
  
  // Storage
  storage: {
    all: ["storage"] as const,
    health: () => ["storage", "health"] as const,
    items: (path: string) => ["storage", "items", path] as const,
    folders: () => ["storage", "folders"] as const,
  },
  
  // AI
  ai: {
    health: () => ["ai", "health"] as const,
    models: () => ["ai", "models"] as const,
  },
  
  // Database
  database: {
    health: (type: string) => ["database", "health", type] as const,
    schemas: (type: string) => ["database", "schemas", type] as const,
  },
  
  // Saved queries
  queries: {
    all: ["queries"] as const,
    list: () => ["queries", "list"] as const,
  },
} as const;
