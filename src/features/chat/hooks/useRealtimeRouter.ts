// chatApp-frontend/src/features/chat/hooks/useRealtimeRouter.ts
import { useCallback, useEffect, useRef } from "react";
import {
  subscribeChatMessage,
  subscribeChatNotify,
  subscribeTyping,
} from "@/shared/ws/socketClient";
import { routeRealtimePayload } from "@/features/chat/utils/wsRouter.js";
import { getOrCreateEcho } from "@/shared/config/realtime";

import { useAppDispatch } from "@/app/store/hooks";
import { updateMessages } from "@/features/chat/state/messageActions";

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
  const appDispatch = useAppDispatch();

  const incomingRef = useRef<IncomingHandler | null>(null);
  const ctxRef = useRef({ selectedRoomId, currentUserId });

  useEffect(() => {
    ctxRef.current.selectedRoomId = selectedRoomId;
  }, [selectedRoomId]);

  useEffect(() => {
    ctxRef.current.currentUserId = currentUserId;
  }, [currentUserId]);

  const registerIncoming = useCallback((fn: IncomingHandler) => {
    incomingRef.current = fn;
    return () => {
      if (incomingRef.current === fn) incomingRef.current = null;
    };
  }, []);

  const routerDispatch = useCallback(
    (a: any) => {
      const p = a?.payload || {};

      if (a?.type === "chat/wsTyping") {
        return incomingRef.current?.({
          type: "typing_indicator",
          room_id: p.roomId,
          roomId: p.roomId,
          user_id: p.userId,
          userId: p.userId,
          isTyping: p.isTyping,
          at: p.at,
        });
      }

      if (a?.type === "chat/wsMessage") {
        appDispatch(
          updateMessages({
            type: "message",
            room_id: p.roomId,
            roomId: p.roomId,
            message: p.message,
          })
        );

        return incomingRef.current?.({
          type: "message",
          room_id: p.roomId,
          roomId: p.roomId,
          message: p.message,
        });
      }

      if (a?.type === "chat/wsNotify") {
        appDispatch(
          updateMessages({
            type: "notify",
            room_id: p.roomId,
            roomId: p.roomId,
            message: p.message,
          })
        );

        return onGlobalNotif?.({
          type: "notify",
          room_id: p.roomId,
          roomId: p.roomId,
          message: p.message,
        });
      }
    },
    [appDispatch, onGlobalNotif]
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

  /* ---------------- Socket.IO (Node + Django) ---------------- */
  useEffect(() => {
    const kind = String(effectiveKind).toLowerCase();
    const isSocketIoBackend = kind === "node" || kind === "django";
    if (!isSocketIoBackend) return;

    const off1 = subscribeChatMessage((p: any) => {
      onRealtimePayload(p, {
        eventName: "chat:message",
        source: kind,
        selectedRoomId: ctxRef.current.selectedRoomId,
        currentUserId: ctxRef.current.currentUserId,
      });
    });

    const off2 = subscribeChatNotify((p: any) => {
      onRealtimePayload(p, {
        eventName: "chat:notify",
        source: kind,
        selectedRoomId: ctxRef.current.selectedRoomId,
        currentUserId: ctxRef.current.currentUserId,
      });
    });

    const off3 = subscribeTyping((p: any) => {
      onRealtimePayload(p, {
        eventName: "typing_indicator",
        source: kind,
        selectedRoomId: ctxRef.current.selectedRoomId,
        currentUserId: ctxRef.current.currentUserId,
      });

      incomingRef.current?.({
        type: "typing_indicator",
        room_id: p?.room_id ?? p?.roomId ?? null,
        roomId: p?.roomId ?? p?.room_id ?? null,
        user_id: p?.user_id ?? p?.userId ?? null,
        userId: p?.userId ?? p?.user_id ?? null,
        isTyping: Boolean(p?.isTyping),
        at: p?.at ?? Date.now(),
        reason: p?.reason ?? null,
      });
    });

    return () => {
      try {
        off1?.();
      } catch {}
      try {
        off2?.();
      } catch {}
      try {
        off3?.();
      } catch {}
    };
  }, [effectiveKind, onRealtimePayload]);

  /* ---------------- Reverb ---------------- */
  const prevRoomRef = useRef<number | null>(null);

  useEffect(() => {
    if (String(effectiveKind).toLowerCase() !== "reverb") return;
    if (!bareToken) return;

    const echo = getOrCreateEcho(bareToken);
    if (!echo) return;

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

    try {
      ch.listen(".chat.message", onRoomMessage);
    } catch {}
    try {
      ch.listen("chat.message", onRoomMessage);
    } catch {}

    // اگر بعداً از backend broadcast event استفاده کردی، این هم فعال باشد
    const onRoomTypingEvent = (p: any) => {
      const evt = {
        type: "typing",
        room_id: p?.room_id ?? p?.roomId ?? selectedRoomId,
        roomId: p?.roomId ?? p?.room_id ?? selectedRoomId,
        user_id: p?.user_id ?? p?.userId ?? null,
        userId: p?.userId ?? p?.user_id ?? null,
        isTyping: Boolean(p?.isTyping),
        at: p?.at ?? Date.now(),
      };

      onRealtimePayload(evt, { eventName: "chat.typing", source: "reverb" });

      incomingRef.current?.(evt);
    };

    try {
      ch.listen(".chat.typing", onRoomTypingEvent);
    } catch {}
    try {
      ch.listen("chat.typing", onRoomTypingEvent);
    } catch {}

    const onTypingWhisper = (p: any) => {
      const evt = {
        type: "typing",
        room_id: p?.room_id ?? p?.roomId ?? selectedRoomId,
        roomId: p?.roomId ?? p?.room_id ?? selectedRoomId,
        user_id: p?.user_id ?? p?.userId ?? null,
        userId: p?.userId ?? p?.user_id ?? null,
        isTyping: Boolean(p?.isTyping),
        at: p?.at ?? Date.now(),
      };

      onRealtimePayload(evt, {
        eventName: "whisper:typing",
        source: "reverb",
      });

      // ✅ این همان fix اصلی است
      incomingRef.current?.(evt);
    };

    try {
      ch.listenForWhisper("typing", onTypingWhisper);
    } catch {}

    return () => {
      try {
        ch.stopListening(".chat.message");
      } catch {}
      try {
        ch.stopListening("chat.message");
      } catch {}
      try {
        ch.stopListening(".chat.typing");
      } catch {}
      try {
        ch.stopListening("chat.typing");
      } catch {}
      try {
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

  /* ---------------- Realtime bus ---------------- */
  useEffect(() => {
    return realtime?.registerHandler?.((p: any, m: any) => onRealtimePayload(p, m));
  }, [realtime, onRealtimePayload]);

  return { registerIncoming } as const;
}