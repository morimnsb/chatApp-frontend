// chatApp-frontend\src\features\chat\hooks\useDocTitleBadge.ts
import { useCallback, useEffect, useRef } from "react";

export type DocTitleBadgeAPI = {
  bump: (inc?: number) => void;
  reset: () => void;
};

export function useDocTitleBadge(): DocTitleBadgeAPI {
  const originalTitleRef = useRef<string>(document.title);
  const countRef = useRef<number>(0);

  // capture initial title
  useEffect(() => {
    originalTitleRef.current = document.title;
  }, []);

  // reset when tab becomes visible
  useEffect(() => {
    const onVis = (): void => {
      if (!document.hidden) {
        countRef.current = 0;
        document.title = originalTitleRef.current;
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const bump = useCallback((inc: number = 1): void => {
    if (!document.hidden) return;

    countRef.current += inc;
    document.title = `(${countRef.current}) ${originalTitleRef.current}`;
  }, []);

  const reset = useCallback((): void => {
    countRef.current = 0;
    document.title = originalTitleRef.current;
  }, []);

  return { bump, reset };
}