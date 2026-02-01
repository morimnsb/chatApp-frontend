import { useCallback, useEffect, useRef } from 'react';

export function useDocTitleBadge() {
  const originalTitleRef = useRef(document.title);
  const countRef = useRef(0);

  useEffect(() => {
    originalTitleRef.current = document.title;
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) {
        countRef.current = 0;
        document.title = originalTitleRef.current;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const bump = useCallback((inc = 1) => {
    if (!document.hidden) return;
    countRef.current += inc;
    document.title = `(${countRef.current}) ${originalTitleRef.current}`;
  }, []);

  const reset = useCallback(() => {
    countRef.current = 0;
    document.title = originalTitleRef.current;
  }, []);

  return { bump, reset };
}
