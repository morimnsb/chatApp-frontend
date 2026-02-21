//chatApp-frontend\src\shared\hooks\useEvent.ts
import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Stable callback reference (like React 19 useEvent)
 * Preserves parameter & return types
 */
export default function useEvent<T extends (...args: any[]) => any>(
  fn: T
): T {
  const ref = useRef<T>(fn);

  useLayoutEffect(() => {
    ref.current = fn;
  });

  return useCallback(
    ((...args: Parameters<T>): ReturnType<T> => {
      return ref.current?.(...args);
    }) as T,
    []
  );
}