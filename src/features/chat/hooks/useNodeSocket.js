// chatApp-frontend/src/features/chat/hooks/useNodeSocket.js
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  disconnectSocket,
  subscribeChatMessage,
  subscribeChatNotify,
  subscribeTyping,
  subscribePresenceOnline,
  subscribePresenceJoin,
  subscribePresenceLeave,
  subscribeConnState,
  emitRoomJoin,
  emitRoomLeave,
  emitTypingIndicator,
  connectSocketIfAuthed
} from "@/shared/ws/socketClient";

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";
const log = (...a) => DEBUG && console.log("[useNodeSocket]", ...a);

function normKind(k) {
  return String(k || "").trim().toLowerCase();
}

function readBackendChoice() {
  try {
    return normKind(localStorage.getItem("backendChoice"));
  } catch {
    return "";
  }
}

function uniqIdsToUsers(ids) {
  const set = new Set((Array.isArray(ids) ? ids : []).map((x) => String(x)));
  return Array.from(set).map((id) => ({ id }));
}

function normRoomId(v) {
  const s = v == null ? null : String(v);
  return s && s !== "null" && s !== "undefined" ? s : null;
}

function isUnauthorizedMsg(msg) {
  return String(msg || "").toUpperCase().includes("UNAUTHORIZED");
}

/**
 * ✅ Node socket hook (SOCKET ONLY THROUGH socketClient)
 *
 * Presence (via socketClient subscribers):
 *  - presence:online / presence:join / presence:leave
 *
 * Realtime:
 *  - chat:message
 *  - typing_indicator (and legacy typing)
 *  - chat:notify  ✅ global notify
 *
 * Emits (via socketClient emit API):
 *  - room:join / room:leave
 *  - typing_indicator
 */
export default function useNodeSocket({
  effectiveKind,
  selectedRoomId,

  // ✅ packets for ChatWindow
  onPacket, // (payload) => void

  // ✅ packets for GlobalNotify (user-level notify)
  onNotify, // (payload) => void
} = {}) {
  const kind = useMemo(() => {
    const k = normKind(effectiveKind);
    return k || readBackendChoice() || "";
  }, [effectiveKind]);

  const isNode = kind === "node" || kind === "nest";

  const [connState, setConnState] = useState("unknown");
  const [onlineUsers, setOnlineUsers] = useState([]);

  const prevRoomRef = useRef(null);

  const onPacketRef = useRef(onPacket);
  const onNotifyRef = useRef(onNotify);

  useEffect(() => {
    onPacketRef.current = onPacket;
  }, [onPacket]);

  useEffect(() => {
    onNotifyRef.current = onNotify;
  }, [onNotify]);

  const roomIdStr = useMemo(() => normRoomId(selectedRoomId), [selectedRoomId]);

  const safeEmitPacket = useCallback((payload) => {
    try {
      onPacketRef.current?.(payload);
    } catch (e) {
      log("onPacket error", e?.message);
    }
  }, []);

  const safeEmitNotify = useCallback((payload) => {
    try {
      onNotifyRef.current?.(payload);
    } catch (e) {
      log("onNotify error", e?.message);
    }
  }, []);

  // =========================
  // ✅ Boot (connState + presence via subscribers)
  // =========================
  useEffect(() => {
    if (!isNode) {
    prevRoomRef.current = null;
    setConnState("unknown");
    setOnlineUsers([]);
    return;
  }

  if (DEBUG) log("boot", { kind, isNode });

  // ✅ ADD THIS LINE
  connectSocketIfAuthed?.("useNodeSocket_boot");

  const offConn = subscribeConnState(({ state, meta }) => {
      setConnState(state || "unknown");

      if (DEBUG) log("connState", { state, meta });

      // ✅ اگر unauthorized شد: سوکت را کامل ریست کن تا با توکن جدید ساخته شود
      if (state === "error" && isUnauthorizedMsg(meta?.message)) {
        try {
          disconnectSocket();
        } catch {}
      }
    });

    const offOnline = subscribePresenceOnline((payload) => {
      setOnlineUsers(uniqIdsToUsers(payload?.ids || []));
    });

    const offJoin = subscribePresenceJoin(({ userId }) => {
      if (userId == null) return;
      const id = String(userId);
      setOnlineUsers((prev) => {
        const s = new Set(prev.map((x) => String(x?.id)));
        s.add(id);
        return Array.from(s).map((x) => ({ id: x }));
      });
    });

    const offLeave = subscribePresenceLeave(({ userId }) => {
      if (userId == null) return;
      const id = String(userId);
      setOnlineUsers((prev) => prev.filter((x) => String(x?.id) !== id));
    });

    return () => {
      offConn?.();
      offOnline?.();
      offJoin?.();
      offLeave?.();
    };
  }, [isNode, kind]);

  // =========================
  // ✅ Realtime subscriptions (DEDUPED)
  // =========================
  useEffect(() => {
    if (!isNode) return;

    const offMsg = subscribeChatMessage((payload) => {
      if (DEBUG) log("chat:message", payload);
      safeEmitPacket(payload);
    });

    const offTyping = subscribeTyping((payload) => {
      if (DEBUG) log("typing_indicator", payload);
      safeEmitPacket(payload);
    });

    const offNotify = subscribeChatNotify((payload) => {
      if (DEBUG) log("chat:notify", payload);
      safeEmitNotify(payload);
    });

    return () => {
      offMsg?.();
      offTyping?.();
      offNotify?.();
    };
  }, [isNode, safeEmitPacket, safeEmitNotify]);

  // =========================
  // ✅ Join/Leave rooms (selectedRoomId) via socketClient emits
  // =========================
  useEffect(() => {
    if (!isNode) return;

    const prev = prevRoomRef.current;
    const next = roomIdStr;

    if (prev && prev !== next) {
      emitRoomLeave({ roomId: prev });
      if (DEBUG) log("leave", { roomId: prev });
    }

    if (next) {
  const ok = emitRoomJoin({ roomId: next });

  // ✅ اگر هنوز وصل نیست، یکبار connect کن و بعداً دوباره join خواهد شد (با انتخاب مجدد یا می‌تونیم auto-retry هم اضافه کنیم)
  if (!ok) connectSocketIfAuthed?.("join_room");

  if (DEBUG) log("join", { roomId: next, ok });
}


    prevRoomRef.current = next;
  }, [isNode, roomIdStr]);

  // =========================
  // ✅ Actions (optional)
  // =========================
  const joinRoom = useCallback(
    (roomId) => {
      if (!isNode) return false;
      const rid = normRoomId(roomId);
      if (!rid) return false;
      const ok = emitRoomJoin({ roomId: rid });
      if (ok) prevRoomRef.current = rid;
      return ok;
    },
    [isNode],
  );

  const leaveRoom = useCallback(
    (roomId) => {
      if (!isNode) return false;
      const rid = normRoomId(roomId);
      if (!rid) return false;
      const ok = emitRoomLeave({ roomId: rid });
      if (prevRoomRef.current === rid) prevRoomRef.current = null;
      return ok;
    },
    [isNode],
  );

  const sendTyping = useCallback(
    ({ roomId, isTyping = true } = {}) => {
      if (!isNode) return false;
      const rid = normRoomId(roomIdStr ?? roomId);
      if (!rid) return false;
      return emitTypingIndicator({ roomId: rid, isTyping: Boolean(isTyping) });
    },
    [isNode, roomIdStr],
  );

  return {
    isNode,
    connState,
    onlineUsers,
    joinRoom,
    leaveRoom,
    sendTyping,
  };
}
