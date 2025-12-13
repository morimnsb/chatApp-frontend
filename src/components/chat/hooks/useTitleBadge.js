import { useEffect, useRef, useCallback } from 'react';

export default function useTitleBadge() {
  const originalTitleRef = useRef(document.title);

  useEffect(() => {
    const onVis = () => { if (!document.hidden) document.title = originalTitleRef.current; };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const bump = useCallback((count = 1) => {
    if (document.hidden) document.title = `(${count}) ${originalTitleRef.current}`;
  }, []);

  return { bump };
}
