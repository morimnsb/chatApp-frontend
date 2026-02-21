// chatApp-frontend\src\features\chat\hooks\useAutoScroll.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

type Options = {
  enabled?: boolean;
  bottomThresholdPx?: number;
};

type ScrollBehaviorLike = ScrollBehavior; // "auto" | "smooth"

export function useAutoScroll({ enabled = true, bottomThresholdPx = 140 }: Options = {}) {
  // ✅ IMPORTANT: type the ref
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isNearBottom, setIsNearBottom] = useState<boolean>(true);
  const [newCount, setNewCount] = useState<number>(0);

  const computeNearBottom = useCallback((): boolean => {
    const el = containerRef.current;
    if (!el) return true;

    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance <= bottomThresholdPx;
  }, [bottomThresholdPx]);

  const onScroll = useCallback(() => {
    const near = computeNearBottom();
    setIsNearBottom(near);

    if (near) setNewCount(0);
  }, [computeNearBottom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    onScroll(); // init

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [enabled, onScroll]);

  const scrollToBottom = useCallback((behavior: ScrollBehaviorLike = "smooth") => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setNewCount(0);
    setIsNearBottom(true);
  }, []);

  const notifyNewMessage = useCallback(() => {
    if (!enabled) return;

    const near = computeNearBottom();
    if (near) {
      scrollToBottom("smooth");
    } else {
      setNewCount((c) => clamp(c + 1, 0, 999));
    }
  }, [enabled, computeNearBottom, scrollToBottom]);

  const ui = useMemo(
    () => ({
      showNewBadge: newCount > 0 && !isNearBottom,
      newCount,
    }),
    [newCount, isNearBottom]
  );

  return {
    containerRef, // RefObject<HTMLDivElement | null>
    scrollToBottom,
    notifyNewMessage,
    isNearBottom,
    ...ui,
  };
}