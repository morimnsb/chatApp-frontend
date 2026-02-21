// chatApp-frontend/src/features/chat/providers/ChatRealtimeProvider.jsx
import React, { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { useSelector } from "react-redux";

import useUserEvents from "@/features/chat/hooks/useUserEvents";
import { useGlobalNotify } from "@/features/chat/hooks/useGlobalNotify";
import { selectBootstrapped, selectToken, selectCurrentUserId } from "@/app/store/authSlice";

const RealtimeCtx = createContext(null);
export const useRealtimeBus = () => useContext(RealtimeCtx);

export default function ChatRealtimeProvider({ effectiveKind, children }) {
  const bootstrapped = useSelector(selectBootstrapped);

  // ✅ standard token (access_token)
  const token = useSelector(selectToken);

  // ✅ standard user id (ONLY from currentUser)
  const currentUserId = useSelector(selectCurrentUserId);

  const selectedRoomId = useSelector(
    (s) => s.messages?.selectedRoom?.id ?? s.messages?.selectedRoom ?? null
  );

  // ✅ enable only when we are really ready
  const shouldEnable = Boolean(
    bootstrapped &&
      token &&
      currentUserId &&
      String(effectiveKind || "").trim().length > 0
  );

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