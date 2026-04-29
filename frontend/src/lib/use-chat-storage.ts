/**
 * Custom hook for persisting AI chat conversations to localStorage.
 * Provides automatic serialisation/deserialisation of conversation data.
 * Uses useSyncExternalStore instead of useEffect for better performance.
 */

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "ai-chat-conversations";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO string for serialisation
  attachments?: { name: string; type: string; size: number }[];
}

export interface StoredConversation {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  preview?: string; // First message preview
  messageCount: number;
}

interface UseChatStorageReturn {
  conversations: StoredConversation[];
  saveConversation: (conversation: StoredConversation) => void;
  deleteConversation: (id: string) => void;
  clearAllConversations: () => void;
  updateConversation: (id: string, updates: Partial<StoredConversation>) => void;
  getConversation: (id: string) => StoredConversation | undefined;
  isLoaded: boolean;
}

// Chat storage store for useSyncExternalStore
const chatStore = {
  listeners: new Set<() => void>(),
  conversations: null as StoredConversation[] | null,
  
  getConversations(): StoredConversation[] {
    if (this.conversations !== null) return this.conversations;
    
    if (typeof window === "undefined") return [];
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredConversation[];
        this.conversations = parsed.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        return this.conversations;
      }
    } catch (error) {
      console.error("Failed to load conversations from localStorage:", error);
    }
    
    this.conversations = [];
    return this.conversations;
  },
  
  setConversations(conversations: StoredConversation[]) {
    this.conversations = conversations;
    
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
      } catch (error) {
        console.error("Failed to save conversations to localStorage:", error);
      }
    }
    
    this.notify();
  },
  
  subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  },
  
  notify() {
    this.listeners.forEach((callback) => callback());
  },
};

/**
 * Hook for managing chat conversations in localStorage.
 * Uses useSyncExternalStore for proper synchronization.
 */
export function useChatStorage(): UseChatStorageReturn {
  const conversations = useSyncExternalStore(
    useCallback((callback) => chatStore.subscribe(callback), []),
    useCallback(() => chatStore.getConversations(), []),
    useCallback(() => [] as StoredConversation[], [])
  );

  const saveConversation = useCallback((conversation: StoredConversation) => {
    const current = chatStore.getConversations();
    const existing = current.findIndex((c) => c.id === conversation.id);
    
    let updated: StoredConversation[];
    if (existing >= 0) {
      updated = [...current];
      updated[existing] = conversation;
    } else {
      updated = [conversation, ...current];
    }
    
    chatStore.setConversations(
      updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    );
  }, []);

  const deleteConversation = useCallback((id: string) => {
    const current = chatStore.getConversations();
    chatStore.setConversations(current.filter((c) => c.id !== id));
  }, []);

  const clearAllConversations = useCallback(() => {
    chatStore.setConversations([]);
  }, []);

  const updateConversation = useCallback(
    (id: string, updates: Partial<StoredConversation>) => {
      const current = chatStore.getConversations();
      chatStore.setConversations(
        current
          .map((c) => (c.id === id ? { ...c, ...updates } : c))
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      );
    },
    []
  );

  const getConversation = useCallback(
    (id: string) => conversations.find((c) => c.id === id),
    [conversations]
  );

  return {
    conversations,
    saveConversation,
    deleteConversation,
    clearAllConversations,
    updateConversation,
    getConversation,
    isLoaded: true, // With useSyncExternalStore, data is always "loaded"
  };
}

/**
 * Group conversations by time period.
 */
export function groupConversationsByTime(conversations: StoredConversation[]): {
  today: StoredConversation[];
  yesterday: StoredConversation[];
  thisWeek: StoredConversation[];
  thisMonth: StoredConversation[];
  older: StoredConversation[];
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const groups = {
    today: [] as StoredConversation[],
    yesterday: [] as StoredConversation[],
    thisWeek: [] as StoredConversation[],
    thisMonth: [] as StoredConversation[],
    older: [] as StoredConversation[],
  };

  conversations.forEach((conv) => {
    const date = new Date(conv.updatedAt);

    if (date >= today) {
      groups.today.push(conv);
    } else if (date >= yesterday) {
      groups.yesterday.push(conv);
    } else if (date >= weekAgo) {
      groups.thisWeek.push(conv);
    } else if (date >= monthAgo) {
      groups.thisMonth.push(conv);
    } else {
      groups.older.push(conv);
    }
  });

  return groups;
}

/**
 * Generate a preview from conversation messages.
 */
export function generatePreview(messages: StoredMessage[], maxLength = 60): string {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (!firstUserMessage) return "New conversation";

  const content = firstUserMessage.content.trim();
  if (content.length <= maxLength) return content;

  return content.substring(0, maxLength).trim() + "...";
}

/**
 * Format relative time for conversation display.
 */
export function formatConversationTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
