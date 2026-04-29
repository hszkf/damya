/**
 * Custom hooks for component lifecycle management.
 * Better alternatives to useEffect for common patterns.
 */

import { useRef, useCallback } from "react";
import { useSyncExternalStore } from "react";

/**
 * Hook to track if component is mounted.
 * Uses useSyncExternalStore for proper lifecycle handling.
 */
export function useMounted(): boolean {
  const mountedRef = useRef(false);

  const subscribe = useCallback((callback: () => void) => {
    mountedRef.current = true;
    callback();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const getSnapshot = useCallback(() => mountedRef.current, []);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Hook that returns a stable callback that checks if component is mounted.
 * Useful for async operations.
 */
export function useMountedCallback(): () => boolean {
  const mountedRef = useRef(true);

  const subscribe = useCallback((callback: () => void) => {
    mountedRef.current = true;
    callback();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const getSnapshot = useCallback(() => null, []);
  const getServerSnapshot = useCallback(() => null, []);

  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useCallback(() => mountedRef.current, []);
}

/**
 * Hook for debounced values.
 * Returns the value after it hasn't changed for the specified delay.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const valueRef = useRef(value);
  const debouncedRef = useRef(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const subscribe = useCallback(
    (callback: () => void) => {
      // Update the value ref
      valueRef.current = value;

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        debouncedRef.current = valueRef.current;
        callback();
      }, delay);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    },
    [value, delay]
  );

  const getSnapshot = useCallback(() => debouncedRef.current, []);
  const getServerSnapshot = useCallback(() => value, [value]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Hook for throttled callbacks.
 * Only allows the callback to be called once per specified delay.
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now;
        return callback(...args);
      }

      // Schedule a call for later if not already scheduled
      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          timeoutRef.current = null;
          callback(...args);
        }, delay - timeSinceLastCall);
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * Hook for previous value tracking.
 * Returns the previous value of a variable.
 */
export function usePrevious<T>(value: T): T | undefined {
  const previousRef = useRef<T | undefined>(undefined);
  const currentRef = useRef<T>(value);

  // Update refs synchronously during render
  if (currentRef.current !== value) {
    previousRef.current = currentRef.current;
    currentRef.current = value;
  }

  return previousRef.current;
}
