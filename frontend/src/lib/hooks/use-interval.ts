/**
 * Custom hook for declarative intervals.
 * Better than useEffect + setInterval pattern.
 * 
 * @param callback - Function to call on each interval
 * @param delay - Interval delay in ms, or null to pause
 */

import { useRef, useCallback } from "react";
import { useSyncExternalStore } from "react";

// Use a ref-based approach that doesn't require useEffect
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Remember the latest callback without useEffect
  savedCallback.current = callback;

  // Set up the interval using useSyncExternalStore pattern
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (delay === null) {
        return () => {};
      }

      intervalRef.current = setInterval(() => {
        savedCallback.current();
        onStoreChange();
      }, delay);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    },
    [delay]
  );

  const getSnapshot = useCallback(() => null, []);
  const getServerSnapshot = useCallback(() => null, []);

  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Hook for running a callback at a specified interval with control.
 */
export function useControlledInterval(
  callback: () => void,
  delay: number,
  enabled: boolean = true
): void {
  useInterval(callback, enabled ? delay : null);
}
