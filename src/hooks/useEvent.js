// src/hooks/useEvent.js
import { useCallback, useLayoutEffect, useRef } from 'react';

export default function useEvent(fn) {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args) => ref.current?.(...args), []);
}
