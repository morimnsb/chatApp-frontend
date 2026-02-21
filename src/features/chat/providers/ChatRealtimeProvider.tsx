// chatApp-frontend/src/features/chat/providers/ChatRealtimeProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useSelector } from "react-redux";

import useUserEvents from "@/features/chat/hooks/useUserEvents";
import { useGlobalNotify } from "@/features/chat/hooks/useGlobalNotify";
import {
  selectBootstrapped,
  selectToken,
  selectCurrentUserId,
} from "@/app/store/authSlice";

/** ---------------- Types ---------------- */

type EffectiveKind = string | null | undefined;

// اگر payload/meta رو دقیق‌تر داری (مثلاً پیام/typing/presence)، بعداً این‌ها رو دقیق می‌کنیم.
export type RealtimeMeta = Record<string, unknown> | undefined;
export type RealtimePayload = unknown;

type NotifyHandler = (payload: RealtimePayload, meta?: RealtimeMeta) => void;

type RealtimeBusValue = {
  registerHandler: (fn: NotifyHandler) => () => void;
};

type Props = {
  effectiveKind: EffectiveKind;
  children: ReactNode;
};

/** ---------------- Context ---------------- */

const RealtimeCtx = createContext<RealtimeBusValue | null>(null);

export const useRealtimeBus = (): RealtimeBusValue => {
  const ctx = useContext(RealtimeCtx);
  if (!ctx) {
    throw new Error("useRealtimeBus must be used within ChatRealtimeProvider");
  }
  return ctx;
};

/** ---------------- Provider ---------------- */

export default function ChatRealtimeProvider({ effectiveKind, children }: Props) {
  const bootstrapped = useSelector(selectBootstrapped);
  const token = useSelector(selectToken);
  const currentUserId = useSelector(selectCurrentUserId);

  const selectedRoomId = useSelector((s: any) => s.messages?.selectedRoom?.id ?? s.messages?.selectedRoom ?? null);

  const shouldEnable = Boolean(
    bootstrapped &&
      token &&
      currentUserId &&
      String(effectiveKind || "").trim().length > 0
  );

  const globalNotify = useGlobalNotify({ selectedRoom: selectedRoomId });

  // ✅ HomeChat will register here
  const handlerRef = useRef<NotifyHandler | null>(null);

  const registerHandler = useCallback((fn: NotifyHandler) => {
    handlerRef.current = fn;
    return () => {
      if (handlerRef.current === fn) handlerRef.current = null;
    };
  }, []);

  const onNotify = useCallback<NotifyHandler>(
    (payload, meta) => {
      // 1) route to HomeChat (messages/typing)
      handlerRef.current?.(payload, meta);
      // 2) also do global toast/badge logic
      globalNotify?.(payload, meta);
    },
    [globalNotify]
  );

  useUserEvents({
    effectiveKind,
    accessToken: shouldEnable ? token : null,
    currentUserId: shouldEnable ? currentUserId : null,
    selectedRoomId,
    onNotify,
  });

  const value = useMemo<RealtimeBusValue>(() => ({ registerHandler }), [registerHandler]);

  return <RealtimeCtx.Provider value={value}>{children}</RealtimeCtx.Provider>;
}