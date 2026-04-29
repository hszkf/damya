/**
 * Custom hook for localStorage with useSyncExternalStore.
 * Better than useEffect + localStorage pattern.
 * Provides automatic cross-tab synchronization.
 */

import { useCallback, useMemo } from "react";
import { useSyncExternalStore } from "react";

// Store for localStorage subscriptions
const localStorageStore = {
  listeners: new Map<string, Set<() => void>>(),
  
  subscribe(key: string, callback: () => void) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);
    
    // Listen for storage events from other tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key) {
        callback();
      }
    };
    
    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
    }
    
    return () => {
      this.listeners.get(key)?.delete(callback);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorage);
      }
    };
  },
  
  notify(key: string) {
    this.listeners.get(key)?.forEach((callback) => callback());
  },
  
  getItem<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },
  
  setItem<T>(key: string, value: T) {
    if (typeof window === "undefined") return;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
      this.notify(key);
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  },
  
  removeItem(key: string) {
    if (typeof window === "undefined") return;
    
    try {
      localStorage.removeItem(key);
      this.notify(key);
    } catch (error) {
      console.error("Failed to remove from localStorage:", error);
    }
  },
};

/**
 * Hook for reading and writing to localStorage with automatic sync
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const subscribe = useCallback(
    (callback: () => void) => localStorageStore.subscribe(key, callback),
    [key]
  );

  const getSnapshot = useCallback(
    () => localStorageStore.getItem(key, initialValue),
    [key, initialValue]
  );

  const getServerSnapshot = useCallback(() => initialValue, [initialValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const currentValue = localStorageStore.getItem(key, initialValue);
      const valueToStore =
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(currentValue)
          : newValue;
      localStorageStore.setItem(key, valueToStore);
    },
    [key, initialValue]
  );

  const removeValue = useCallback(() => {
    localStorageStore.removeItem(key);
  }, [key]);

  return [value, setValue, removeValue];
}

/**
 * Hook for simple boolean flags in localStorage
 */
export function useLocalStorageFlag(
  key: string,
  initialValue: boolean = false
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useLocalStorage(key, initialValue);

  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, [setValue]);

  return [value, toggle, setValue];
}

/**
 * Hook for theme preference with system preference fallback
 */
export function useThemePreference(
  key: string = "theme"
): ["light" | "dark", (theme: "light" | "dark") => void] {
  const getSystemTheme = useCallback((): "light" | "dark" => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }, []);

  const subscribe = useCallback(
    (callback: () => void) => {
      const unsubStorage = localStorageStore.subscribe(key, callback);
      
      // Also listen for system preference changes
      const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
      const handleChange = () => callback();
      mediaQuery.addEventListener("change", handleChange);
      
      return () => {
        unsubStorage();
        mediaQuery.removeEventListener("change", handleChange);
      };
    },
    [key]
  );

  const getSnapshot = useCallback((): "light" | "dark" => {
    const stored = localStorageStore.getItem<"light" | "dark" | null>(key, null);
    if (stored === "light" || stored === "dark") return stored;
    return getSystemTheme();
  }, [key, getSystemTheme]);

  const getServerSnapshot = useCallback((): "light" | "dark" => "dark", []);

  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback(
    (newTheme: "light" | "dark") => {
      localStorageStore.setItem(key, newTheme);
      // Also update DOM class
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(newTheme);
      }
    },
    [key]
  );

  return [theme, setTheme];
}
