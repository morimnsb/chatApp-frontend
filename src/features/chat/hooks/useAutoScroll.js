import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function useAutoScroll({ enabled = true, bottomThresholdPx = 140 } = {}) {
  const containerRef = useRef(null);

  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);

  const computeNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;

    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance <= bottomThresholdPx;
  }, [bottomThresholdPx]);

  const onScroll = useCallback(() => {
    const near = computeNearBottom();
    setIsNearBottom(near);

    // اگر کاربر برگشت پایین، شمارنده‌ی پیام جدید صفر شود
    if (near) setNewCount(0);
  }, [computeNearBottom]);

  // attach scroll listener
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    onScroll(); // init

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [enabled, onScroll]);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setNewCount(0);
    setIsNearBottom(true);
  }, []);

  // call this when a new message is appended to UI
  const notifyNewMessage = useCallback(() => {
    if (!enabled) return;

    const near = computeNearBottom();
    if (near) {
      // اگر نزدیک پایین بود، بدون ایجاد اسپم برو پایین
      scrollToBottom('smooth');
    } else {
      // اگر کاربر بالاست، فقط شمارنده را بالا ببر
      setNewCount((c) => clamp(c + 1, 0, 999));
    }
  }, [enabled, computeNearBottom, scrollToBottom]);

  const ui = useMemo(
    () => ({
      showNewBadge: newCount > 0 && !isNearBottom,
      newCount,
    }),
    [newCount, isNearBottom],
  );

  return { containerRef, scrollToBottom, notifyNewMessage, isNearBottom, ...ui };
}
