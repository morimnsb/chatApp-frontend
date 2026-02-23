// chatApp-frontend/src/features/chat/hooks/useRealtimeRouter.ts
import { useCallback, useEffect, useRef } from "react";
import { subscribeChatMessage, subscribeTyping } from "@/shared/ws/socketClient";
import { routeRealtimePayload } from "@/features/chat/utils/wsRouter.js";

// ✅ Echo (Reverb)
import { getOrCreateEcho } from "@/shared/config/realtime";

type IncomingHandler = (evt: any) => void;

export type UseRealtimeRouterArgs = {
  effectiveKind: string;
  selectedRoomId: number | null;
  currentUserId: number | null;
  onGlobalNotif?: (x: any) => void;
  realtime?: { registerHandler?: (fn: (p: any, m: any) => void) => () => void };
  bareToken?: string | null;
};

export default function useRealtimeRouter({
  effectiveKind,
  selectedRoomId,
  currentUserId,
  onGlobalNotif,
  realtime,
  bareToken,
}: UseRealtimeRouterArgs) {
  const incomingRef = useRef<IncomingHandler | null>(null);
  const ctxRef = useRef({ selectedRoomId, currentUserId });

  useEffect(() => void (ctxRef.current.selectedRoomId = selectedRoomId), [selectedRoomId]);
  useEffect(() => void (ctxRef.current.currentUserId = currentUserId), [currentUserId]);

  const registerIncoming = useCallback((fn: IncomingHandler) => {
    incomingRef.current = fn;
    return () => (incomingRef.current === fn ? (incomingRef.current = null) : undefined);
  }, []);

  const routerDispatch = useCallback(
    (a: any) => {
      const p = a?.payload || {};

      if (a?.type === "chat/wsTyping") {
        return incomingRef.current?.({
          type: "typing_indicator",
          roomId: p.roomId,
          userId: p.userId,
          isTyping: p.isTyping,
          at: p.at,
        });
      }

      if (a?.type === "chat/wsMessage") {
        return incomingRef.current?.({ type: "message", room_id: p.roomId, message: p.message });
      }

      if (a?.type === "chat/wsNotify") {
        return onGlobalNotif?.({ type: "notify", room_id: p.roomId, roomId: p.roomId, message: p.message });
      }
    },
    [onGlobalNotif]
  );

  const onRealtimePayload = useCallback(
    (payload: any, meta?: any) =>
      routeRealtimePayload(payload, {
        dispatch: routerDispatch,
        selectedRoomId: meta?.selectedRoomId ?? ctxRef.current.selectedRoomId,
        currentUserId: meta?.currentUserId ?? ctxRef.current.currentUserId,
        sourceEventName: meta?.eventName ?? meta?.sourceEventName ?? null,
        eventName: meta?.eventName ?? meta?.sourceEventName ?? null,
      }),
    [routerDispatch]
  );

  /* ---------------- Node (Socket.IO) ---------------- */
  useEffect(() => {
    if (String(effectiveKind).toLowerCase() !== "node") return;

    const off1 = subscribeChatMessage((p: any) =>
      onRealtimePayload(p, { eventName: "chat:message", source: "node" })
    );
    const off2 = subscribeTyping((p: any) =>
      onRealtimePayload(p, { eventName: "typing", source: "node" })
    );

    return () => {
      try {
        off1?.();
      } catch {}
      try {
        off2?.();
      } catch {}
    };
  }, [effectiveKind, onRealtimePayload]);

  /* ---------------- Reverb (Echo) room join like Node (NO HTTP) ---------------- */
  const prevRoomRef = useRef<number | null>(null);

  useEffect(() => {
    if (String(effectiveKind).toLowerCase() !== "reverb") return;
    if (!bareToken) return;

    const echo = getOrCreateEcho(bareToken);
    if (!echo) return;

    // leave old room if changed
    const prev = prevRoomRef.current;
    if (prev && prev !== selectedRoomId) {
      try {
        echo.leave(`chat.${prev}`);
      } catch {}
      try {
        echo.leave(`private-chat.${prev}`);
      } catch {}
      prevRoomRef.current = null;
    }

    if (!selectedRoomId) return;

    prevRoomRef.current = selectedRoomId;

    const ch = echo.private(`chat.${selectedRoomId}`);

    /* ✅ 1) ROOM MESSAGE (broadcastAs: 'chat.message') */
    const onRoomMessage = (p: any) =>
      onRealtimePayload(
        {
          type: "message",
          room_id: p?.room_id ?? p?.roomId ?? selectedRoomId,
          roomId: p?.roomId ?? p?.room_id ?? selectedRoomId,
          message: p?.message ?? p,
        },
        { eventName: "chat.message", source: "reverb" }
      );

    // listen to both dot + non-dot (Echo versions differ)
    try {
      ch.listen(".chat.message", onRoomMessage);
    } catch {}
    try {
      ch.listen("chat.message", onRoomMessage);
    } catch {}

    /* ✅ 2) TYPING via WHISPER (NO HTTP) */
    const onTypingWhisper = (p: any) =>
      
  onRealtimePayload(
    {
      type: "typing",
      room_id: selectedRoomId,
      roomId: selectedRoomId,
      user_id: p?.user_id ?? p?.userId ?? null,
      userId: p?.user_id ?? p?.userId ?? null,
      isTyping: Boolean(p?.isTyping),
      at: p?.at ?? Date.now(),
    },
    { eventName: "whisper:typing", source: "reverb" }
  );

    // Echo whisper API
    try {
      ch.listenForWhisper("typing", onTypingWhisper);
    } catch {}

    return () => {
      try {
        // optional (not available in all versions)
        ch.stopListeningForWhisper?.("typing");
      } catch {}
      try {
        echo.leave(`chat.${selectedRoomId}`);
      } catch {}
      try {
        echo.leave(`private-chat.${selectedRoomId}`);
      } catch {}
    };
  }, [effectiveKind, bareToken, selectedRoomId, onRealtimePayload]);

  /* ---------------- Realtime bus (generic) ---------------- */
  useEffect(() => {
    return realtime?.registerHandler?.((p: any, m: any) => onRealtimePayload(p, m));
  }, [realtime, onRealtimePayload]);

  return { registerIncoming } as const;
}