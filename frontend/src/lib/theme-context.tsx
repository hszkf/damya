import * as React from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "sql-studio-theme";

// Theme store for useSyncExternalStore
const themeStore = {
  listeners: new Set<() => void>(),
  
  getTheme(): Theme {
    if (typeof window === "undefined") return "dark";

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;

    return "dark";
  },
  
  setTheme(theme: Theme) {
    if (typeof window === "undefined") return;
    
    localStorage.setItem(STORAGE_KEY, theme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    this.notify();
  },
  
  subscribe(callback: () => void) {
    this.listeners.add(callback);
    
    // Initialize DOM class on first subscribe
    if (typeof window !== "undefined") {
      const theme = this.getTheme();
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(theme);
    }
    
    // Listen for storage events from other tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(e.newValue);
        callback();
      }
    };
    
    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
    }
    
    return () => {
      this.listeners.delete(callback);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorage);
      }
    };
  },
  
  notify() {
    this.listeners.forEach((callback) => callback());
  },
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Use useSyncExternalStore for theme state
  const theme = React.useSyncExternalStore(
    React.useCallback((callback) => themeStore.subscribe(callback), []),
    React.useCallback(() => themeStore.getTheme(), []),
    React.useCallback(() => "dark" as Theme, [])
  );

  const setTheme = React.useCallback((newTheme: Theme) => {
    themeStore.setTheme(newTheme);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = React.useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
