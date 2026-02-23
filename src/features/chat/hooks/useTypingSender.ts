// chatApp-frontend/src/features/chat/hooks/useTypingSender.ts
import { useCallback, useEffect, useMemo, useRef } from "react";
import { getOrCreateEcho } from "@/shared/config/realtime";

// اگر Node emitter داری، اینجا فعالش کن
import { emitTypingIndicator } from "@/shared/ws/socketClient";
type Payload = { roomId: number | string; isTyping: boolean };

export default function useTypingSender({
  effectiveKind,
  bareToken,
  currentUserId,
}: {
  effectiveKind: string;
  bareToken?: string | null;
  currentUserId?: number | string | null;
}) {
  const kind = String(effectiveKind || "").toLowerCase();
  const isReverb = kind === "reverb";
  const isNode = kind === "node";

  const cfg = useMemo(
    () => ({
      throttleMs: isNode ? 250 : 700,
      stopDebounceMs: isNode ? 600 : 900,
    }),
    [isNode]
  );

  const lastRef = useRef<{ rid: number; state: boolean; ts: number } | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRidRef = useRef<number | null>(null);

  const whisperTyping = (rid: number, isTyping: boolean) => {
    if (!isReverb) return false;
    if (!bareToken) return false;

    const uid = Number(currentUserId);
    if (!uid) return false;

    const echo = getOrCreateEcho(bareToken);
    if (!echo) return false;

    try {
      // ✅ must be same channel name you join in useRealtimeRouter
      echo.private(`chat.${rid}`).whisper("typing", {
        user_id: uid,
        userId: uid,
        room_id: rid,
        roomId: rid,
        isTyping: Boolean(isTyping),
        at: Date.now(),
      });
      return true;
    } catch {
      return false;
    }
  };

  const sendStop = (rid: number) => {
    if (isNode) {
      // emitTypingIndicator({ roomId: rid, isTyping: false });
      return true;
    }
    if (isReverb) return whisperTyping(rid, false);
    return false;
  };

  const sendStart = (rid: number) => {
    if (isNode) {
      emitTypingIndicator({ roomId: rid, isTyping: true });
      return true;
    }
    if (isReverb) return whisperTyping(rid, true);
    return false;
  };

  // ✅ unmount => stop typing
  useEffect(() => {
    return () => {
      const rid = lastRidRef.current;
      if (rid) sendStop(rid);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReverb, isNode]);

  return useCallback(
    ({ roomId, isTyping }: Payload) => {
      const rid = Number(roomId);
      if (!rid) return false;
      if (!isReverb && !isNode) return false;

      lastRidRef.current = rid;

      const now = Date.now();
      const last = lastRef.current;

      // same state => refresh stop timer if typing
      if (last?.rid === rid && last.state === isTyping) {
        if (isTyping) {
          if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
          stopTimerRef.current = setTimeout(() => {
            lastRef.current = { rid, state: false, ts: Date.now() };
            sendStop(rid);
          }, cfg.stopDebounceMs);
        }
        return true;
      }

      if (isTyping) {
        // throttle start
        if (last?.rid === rid && last.state === true && now - last.ts < cfg.throttleMs) {
          if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
          stopTimerRef.current = setTimeout(() => {
            lastRef.current = { rid, state: false, ts: Date.now() };
            sendStop(rid);
          }, cfg.stopDebounceMs);
          return true;
        }

        lastRef.current = { rid, state: true, ts: now };

        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        stopTimerRef.current = setTimeout(() => {
          lastRef.current = { rid, state: false, ts: Date.now() };
          sendStop(rid);
        }, cfg.stopDebounceMs);

        sendStart(rid);
        return true;
      }

      // isTyping false
      lastRef.current = { rid, state: false, ts: now };
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      sendStop(rid);
      return true;
    },
    [isReverb, isNode, bareToken, currentUserId, cfg.throttleMs, cfg.stopDebounceMs]
  );
}