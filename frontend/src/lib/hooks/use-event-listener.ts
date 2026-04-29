/**
 * Custom hook for declarative event listeners.
 * Better than useEffect + addEventListener pattern.
 */

import { useRef, useCallback } from "react";
import { useSyncExternalStore } from "react";

type EventMap = WindowEventMap & DocumentEventMap & HTMLElementEventMap;

interface UseEventListenerOptions<K extends keyof EventMap> {
  target?: Window | Document | HTMLElement | null;
  eventName: K;
  handler: (event: EventMap[K]) => void;
  options?: AddEventListenerOptions;
  enabled?: boolean;
}

/**
 * Hook for adding event listeners declaratively
 */
export function useEventListener<K extends keyof EventMap>({
  target,
  eventName,
  handler,
  options,
  enabled = true,
}: UseEventListenerOptions<K>): void {
  const savedHandler = useRef(handler);
  savedHandler.current = handler;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const targetElement = target ?? (typeof window !== "undefined" ? window : null);
      
      if (!enabled || !targetElement) {
        return () => {};
      }

      const eventListener = (event: Event) => {
        savedHandler.current(event as EventMap[K]);
        onStoreChange();
      };

      targetElement.addEventListener(eventName, eventListener, options);

      return () => {
        targetElement.removeEventListener(eventName, eventListener, options);
      };
    },
    [target, eventName, options, enabled]
  );

  const getSnapshot = useCallback(() => null, []);
  const getServerSnapshot = useCallback(() => null, []);

  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Hook for keyboard shortcuts
 */
export function useKeyboardShortcut(
  key: string,
  callback: (event: KeyboardEvent) => void,
  options: {
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    enabled?: boolean;
  } = {}
): void {
  const { ctrlKey, metaKey, shiftKey, altKey, enabled = true } = options;

  const handler = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== key) return;
      if (ctrlKey !== undefined && event.ctrlKey !== ctrlKey) return;
      if (metaKey !== undefined && event.metaKey !== metaKey) return;
      if (shiftKey !== undefined && event.shiftKey !== shiftKey) return;
      if (altKey !== undefined && event.altKey !== altKey) return;

      callback(event);
    },
    [key, ctrlKey, metaKey, shiftKey, altKey, callback]
  );

  useEventListener({
    eventName: "keydown",
    handler,
    enabled,
  });
}

/**
 * Hook for click outside detection
 */
export function useClickOutside(
  ref: React.RefObject<HTMLElement>,
  callback: () => void,
  enabled: boolean = true
): void {
  const handler = useCallback(
    (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    },
    [ref, callback]
  );

  useEventListener({
    eventName: "mousedown",
    handler,
    target: typeof document !== "undefined" ? document : null,
    enabled,
  });
}

/**
 * Hook for scroll position tracking
 */
export function useScrollPosition(): number {
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (typeof window === "undefined") return () => {};
    
    const handleScroll = () => onStoreChange();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return 0;
    return window.scrollY;
  }, []);

  const getServerSnapshot = useCallback(() => 0, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Hook for window resize tracking
 */
export function useWindowSize(): { width: number; height: number } {
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (typeof window === "undefined") return () => {};
    
    window.addEventListener("resize", onStoreChange);
    return () => window.removeEventListener("resize", onStoreChange);
  }, []);

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return { width: 0, height: 0 };
    return { width: window.innerWidth, height: window.innerHeight };
  }, []);

  const getServerSnapshot = useCallback(() => ({ width: 0, height: 0 }), []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
