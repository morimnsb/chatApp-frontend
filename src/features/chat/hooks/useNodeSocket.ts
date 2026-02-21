//chatApp-frontend\src\features\chat\hooks\useNodeSocket.ts
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
  connectSocketIfAuthed,
} from "@/shared/ws/socketClient";

type Id = string | number;

type ConnState = "unknown" | "connecting" | "connected" | "disconnected" | "error" | string;

type PresenceUser = { id: string };

type ConnStatePayload = {
  state?: ConnState;
  meta?: { message?: string; [k: string]: any } | null;
};

type PresenceOnlinePayload = { ids?: Array<Id> | null };
type PresenceJoinLeavePayload = { userId?: Id | null };

export type NodeSocketPacket = any; // چون چند بک‌اندی/چند eventی هستید
export type NodeNotifyPacket = any;

type UseNodeSocketArgs = {
  effectiveKind?: string | null;
  selectedRoomId?: Id | null;

  onPacket?: (payload: NodeSocketPacket) => void;
  onNotify?: (payload: NodeNotifyPacket) => void;
};

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";
const log = (...a: any[]) => DEBUG && console.log("[useNodeSocket]", ...a);

function normKind(k: unknown): string {
  return String(k || "").trim().toLowerCase();
}

function readBackendChoice(): string {
  try {
    return normKind(localStorage.getItem("backendChoice"));
  } catch {
    return "";
  }
}

function uniqIdsToUsers(ids: unknown): PresenceUser[] {
  const arr = Array.isArray(ids) ? ids : [];
  const set = new Set(arr.map((x) => String(x)));
  return Array.from(set).map((id) => ({ id }));
}

function normRoomId(v: unknown): string | null {
  const s = v == null ? null : String(v);
  return s && s !== "null" && s !== "undefined" ? s : null;
}

function isUnauthorizedMsg(msg: unknown): boolean {
  return String(msg || "").toUpperCase().includes("UNAUTHORIZED");
}

/**
 * ✅ Node socket hook (SOCKET ONLY THROUGH socketClient)
 */
export default function useNodeSocket({
  effectiveKind,
  selectedRoomId,
  onPacket,
  onNotify,
}: UseNodeSocketArgs = {}) {
  const kind = useMemo(() => {
    const k = normKind(effectiveKind);
    return k || readBackendChoice() || "";
  }, [effectiveKind]);

  const isNode = kind === "node" || kind === "nest";

  const [connState, setConnState] = useState<ConnState>("unknown");
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  const prevRoomRef = useRef<string | null>(null);

  const onPacketRef = useRef<UseNodeSocketArgs["onPacket"]>(onPacket);
  const onNotifyRef = useRef<UseNodeSocketArgs["onNotify"]>(onNotify);

  useEffect(() => {
    onPacketRef.current = onPacket;
  }, [onPacket]);

  useEffect(() => {
    onNotifyRef.current = onNotify;
  }, [onNotify]);

  const roomIdStr = useMemo(() => normRoomId(selectedRoomId), [selectedRoomId]);

  const safeEmitPacket = useCallback((payload: NodeSocketPacket) => {
    try {
      onPacketRef.current?.(payload);
    } catch (e: any) {
      log("onPacket error", e?.message);
    }
  }, []);

  const safeEmitNotify = useCallback((payload: NodeNotifyPacket) => {
    try {
      onNotifyRef.current?.(payload);
    } catch (e: any) {
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

    // ✅ ensure socket exists if we already have token
    connectSocketIfAuthed?.("useNodeSocket_boot");

    const offConn = subscribeConnState?.((payload: ConnStatePayload) => {
      const state = payload?.state ?? "unknown";
      const meta = payload?.meta ?? null;

      setConnState(state);

      if (DEBUG) log("connState", { state, meta });

      // ✅ unauthorized => reset socket so next connect uses fresh token
      if (state === "error" && isUnauthorizedMsg(meta?.message)) {
        try {
          disconnectSocket?.();
        } catch {
          // ignore
        }
      }
    });

    const offOnline = subscribePresenceOnline?.((payload: PresenceOnlinePayload) => {
      setOnlineUsers(uniqIdsToUsers(payload?.ids || []));
    });

    const offJoin = subscribePresenceJoin?.((payload: PresenceJoinLeavePayload) => {
      const userId = payload?.userId ?? null;
      if (userId == null) return;

      const id = String(userId);
      setOnlineUsers((prev) => {
        const s = new Set(prev.map((x) => String(x?.id)));
        s.add(id);
        return Array.from(s).map((x) => ({ id: x }));
      });
    });

    const offLeave = subscribePresenceLeave?.((payload: PresenceJoinLeavePayload) => {
      const userId = payload?.userId ?? null;
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

    const offMsg = subscribeChatMessage?.((payload: NodeSocketPacket) => {
      if (DEBUG) log("chat:message", payload);
      safeEmitPacket(payload);
    });

    const offTyping = subscribeTyping?.((payload: NodeSocketPacket) => {
      if (DEBUG) log("typing_indicator", payload);
      safeEmitPacket(payload);
    });

    const offNotify = subscribeChatNotify?.((payload: NodeNotifyPacket) => {
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
      emitRoomLeave?.({ roomId: prev });
      if (DEBUG) log("leave", { roomId: prev });
    }

    if (next) {
      const ok = emitRoomJoin?.({ roomId: next }) ?? false;

      // ✅ اگر هنوز وصل نیست، یکبار connect کن
      if (!ok) connectSocketIfAuthed?.("join_room");

      if (DEBUG) log("join", { roomId: next, ok });
    }

    prevRoomRef.current = next;
  }, [isNode, roomIdStr]);

  // =========================
  // ✅ Actions (optional)
  // =========================
  const joinRoom = useCallback(
    (roomId: Id | null | undefined): boolean => {
      if (!isNode) return false;
      const rid = normRoomId(roomId);
      if (!rid) return false;

      const ok = emitRoomJoin?.({ roomId: rid }) ?? false;
      if (ok) prevRoomRef.current = rid;
      return ok;
    },
    [isNode]
  );

  const leaveRoom = useCallback(
    (roomId: Id | null | undefined): boolean => {
      if (!isNode) return false;
      const rid = normRoomId(roomId);
      if (!rid) return false;

      const ok = emitRoomLeave?.({ roomId: rid }) ?? false;
      if (prevRoomRef.current === rid) prevRoomRef.current = null;
      return ok;
    },
    [isNode]
  );

  const sendTyping = useCallback(
    (args: { roomId?: Id | null; isTyping?: boolean } = {}): boolean => {
      if (!isNode) return false;

      const rid = normRoomId(roomIdStr ?? args.roomId);
      if (!rid) return false;

      return (emitTypingIndicator?.({ roomId: rid, isTyping: Boolean(args.isTyping ?? true) }) ??
        false) as boolean;
    },
    [isNode, roomIdStr]
  );

  return {
    isNode,
    connState,
    onlineUsers,
    joinRoom,
    leaveRoom,
    sendTyping,
  } as const;
}