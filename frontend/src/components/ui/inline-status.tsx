import * as React from "react";

type Status = "idle" | "loading" | "success" | "error";

interface UseInlineStatusReturn {
  status: Status;
  message: string;
  setStatus: (status: Status, message?: string) => void;
  reset: () => void;
}

export function useInlineStatus(autoResetMs = 3000): UseInlineStatusReturn {
  const [status, setStatusState] = React.useState<Status>("idle");
  const [message, setMessage] = React.useState("");
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const reset = React.useCallback(() => {
    setStatusState("idle");
    setMessage("");
  }, []);

  const setStatus = React.useCallback((newStatus: Status, msg = "") => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    setStatusState(newStatus);
    setMessage(msg);
    
    // Set auto-reset timer for success/error states
    if (newStatus === "success" || newStatus === "error") {
      timerRef.current = setTimeout(reset, autoResetMs);
    }
  }, [autoResetMs, reset]);

  // Cleanup timer using useSyncExternalStore pattern
  const subscribe = React.useCallback((callback: () => void) => {
    callback();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);
  
  React.useSyncExternalStore(
    subscribe,
    React.useCallback(() => null, []),
    React.useCallback(() => null, [])
  );

  return { status, message, setStatus, reset };
}

interface InlineStatusProps {
  status: Status;
  message?: string;
}

export function InlineStatus({ status, message }: InlineStatusProps) {
  if (status === "idle") return null;

  const styles = {
    loading: "text-gray-500",
    success: "text-green-600",
    error: "text-red-600",
  };

  return (
    <span className={`text-sm ${styles[status]}`}>
      {status === "loading" && "Loading..."}
      {status === "success" && (message || "Done")}
      {status === "error" && (message || "Error")}
    </span>
  );
}
