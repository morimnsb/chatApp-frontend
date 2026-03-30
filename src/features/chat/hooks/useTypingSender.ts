// chatApp-frontend/src/features/chat/hooks/useTypingSender.ts
import { useCallback, useEffect, useMemo, useRef } from "react";
import { getOrCreateEcho } from "@/shared/config/realtime";
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
  const isSocketIo = kind === "node" || kind === "django";

  const cfg = useMemo(
    () => ({
      throttleMs: isSocketIo ? 250 : 700,
      stopDebounceMs: isSocketIo ? 600 : 900,
    }),
    [isSocketIo]
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
    if (isSocketIo) {
      return emitTypingIndicator({ roomId: rid, isTyping: false });
    }
    if (isReverb) return whisperTyping(rid, false);
    return false;
  };

  const sendStart = (rid: number) => {
    if (isSocketIo) {
      return emitTypingIndicator({ roomId: rid, isTyping: true });
    }
    if (isReverb) return whisperTyping(rid, true);
    return false;
  };

  useEffect(() => {
    return () => {
      const rid = lastRidRef.current;
      if (rid) sendStop(rid);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, [isReverb, isSocketIo]);

  return useCallback(
    ({ roomId, isTyping }: Payload) => {
      const rid = Number(roomId);
      if (!rid) return false;
      if (!isReverb && !isSocketIo) return false;

      lastRidRef.current = rid;

      const now = Date.now();
      const last = lastRef.current;

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

        return sendStart(rid);
      }

      lastRef.current = { rid, state: false, ts: now };
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      return sendStop(rid);
    },
    [isReverb, isSocketIo, bareToken, currentUserId, cfg.throttleMs, cfg.stopDebounceMs]
  );
}