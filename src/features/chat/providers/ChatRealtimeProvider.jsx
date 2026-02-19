import React, { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { useSelector } from "react-redux";

import useUserEvents from "@/features/chat/hooks/useUserEvents";
import { useGlobalNotify } from "@/features/chat/hooks/useGlobalNotify";
import { selectBootstrapped, selectToken } from "@/app/store/authSlice";

const RealtimeCtx = createContext(null);
export const useRealtimeBus = () => useContext(RealtimeCtx);

export default function ChatRealtimeProvider({ effectiveKind, children }) {
  const bootstrapped = useSelector(selectBootstrapped);
  const token = useSelector(selectToken);

  const currentUserId = useSelector(
    (s) => s.auth?.user?.id ?? s.auth?.currentUser?.id ?? null
  );

  const selectedRoomId = useSelector(
    (s) => s.messages?.selectedRoom?.id ?? s.messages?.selectedRoom ?? null
  );

  const shouldEnable = Boolean(bootstrapped && token && currentUserId);

  const globalNotify = useGlobalNotify({ selectedRoom: selectedRoomId });

  // ✅ HomeChat will register here
  const handlerRef = useRef(null);
  const registerHandler = useCallback((fn) => {
    handlerRef.current = fn;
    return () => {
      if (handlerRef.current === fn) handlerRef.current = null;
    };
  }, []);

  const onNotify = useCallback(
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

  const value = useMemo(() => ({ registerHandler }), [registerHandler]);

  return <RealtimeCtx.Provider value={value}>{children}</RealtimeCtx.Provider>;
}
