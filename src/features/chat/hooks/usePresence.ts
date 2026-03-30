// chatApp-frontend/src/features/chat/hooks/usePresence.ts
import { useEffect, useMemo, useState } from "react";
import { getOrCreateEcho } from "@/shared/config/realtime";
import {
  subscribePresenceJoin,
  subscribePresenceLeave,
  subscribePresenceOnline,
  subscribeConnState,
} from "@/shared/ws/socketClient";

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";
const log = (...a: any[]) => DEBUG && console.log("[usePresence]", ...a);

const PRESENCE_NAME_REVERB = "global";

type Id = string | number;

export type PresenceBackendKind = "reverb" | "node" | "django" | "none" | "";

export type PresenceUser = {
  id?: Id | null;
  user_id?: Id | null;
  user?: { id?: Id | null } | null;
  name?: string | null;
  email?: string | null;
  [k: string]: any;
};

type ConnState =
  | "unknown"
  | "idle"
  | "connecting"
  | "subscribing"
  | "connected"
  | "error"
  | "error-missing-api";

type UsePresenceArgs = {
  backendKind?: PresenceBackendKind;
  token?: string | null;
  currentUserId?: Id | null;
};

const toIdStr = (u: unknown): string | null => {
  const anyU = u as any;
  const id = anyU?.id ?? anyU?.user_id ?? anyU?.user?.id ?? anyU;
  return id == null ? null : String(id);
};

export function usePresence({ backendKind, token, currentUserId }: UsePresenceArgs = {}) {
  const backend = String(backendKind || "").toLowerCase() as PresenceBackendKind;
  const isReverb = backend === "reverb";
  const isNode = backend === "node";
  const isDjango = backend === "django";

  const hasToken = Boolean(token);
  const hasUser = Number(currentUserId) > 0;

  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [connState, setConnState] = useState<ConnState>("unknown");

  const key = useMemo(() => {
    if (!isReverb || !hasToken || !hasUser) return null;
    const tk = String(token).slice(0, 18);
    return `reverb|presence|${currentUserId}|${tk}`;
  }, [isReverb, hasToken, hasUser, currentUserId, token]);

  const busKey = useMemo(() => {
    if (!(isNode || isDjango) || !hasToken || !hasUser) return null;
    const tk = String(token).slice(0, 18);
    return `${backend}|presence|${currentUserId}|${tk}`;
  }, [backend, isNode, isDjango, hasToken, hasUser, currentUserId, token]);

  /* ===================== Reverb ===================== */

  useEffect(() => {
    if (!key) return;

    const echo = getOrCreateEcho(String(token || "")) as any;
    if (!echo) return;

    const conn = echo?.connector?.pusher?.connection;
    if (!conn) return;

    const sync = () => setConnState((conn.state as ConnState) || "unknown");
    sync();

    const onState = (st: any) => {
      setConnState((st?.current as ConnState) || (conn.state as ConnState) || "unknown");
      log("pusher state_change", st);
    };

    conn.bind?.("state_change", onState);
    conn.bind?.("connected", sync);
    conn.bind?.("disconnected", sync);

    return () => {
      try {
        conn.unbind?.("state_change", onState);
        conn.unbind?.("connected", sync);
        conn.unbind?.("disconnected", sync);
      } catch {}
    };
  }, [key, token]);

  useEffect(() => {
    if (!key) return;

    const echo = getOrCreateEcho(String(token || "")) as any;
    if (!echo) return;

    let ch: any;

    try {
      ch = echo.join(PRESENCE_NAME_REVERB);

      ch.here((users: PresenceUser[]) => {
        const arr = Array.isArray(users) ? users : [];
        setOnlineUsers(arr);
        log("reverb here ✅", { count: arr.length });
      });

      ch.joining((user: PresenceUser) => {
        const id = toIdStr(user);
        if (!id) return;
        setOnlineUsers((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          if (arr.some((x) => toIdStr(x) === id)) return arr;
          return [...arr, user];
        });
      });

      ch.leaving((user: PresenceUser) => {
        const id = toIdStr(user);
        if (!id) return;
        setOnlineUsers((prev) => (Array.isArray(prev) ? prev.filter((x) => toIdStr(x) !== id) : []));
      });

      setConnState("connected");
      log("reverb presence joined ✅", { name: PRESENCE_NAME_REVERB });
    } catch (e) {
      log("reverb presence join failed", e);
      setConnState("error");
    }

    return () => {
      try {
        echo.leave(PRESENCE_NAME_REVERB);
      } catch {}
      setOnlineUsers([]);
      setConnState("idle");
    };
  }, [key, token]);

  /* ===================== Node + Django via socketClient ===================== */

  useEffect(() => {
    if (!busKey) return;

    setOnlineUsers([]);
    setConnState("connecting");

    const unsubConn = subscribeConnState((evt) => {
      const state = String(evt?.state || "").toLowerCase();
      if (state === "connected") setConnState("connected");
      else if (state === "disconnected") setConnState("idle");
      else if (state === "error") setConnState("error");
    });

    const unsubOnline = subscribePresenceOnline((payload: any) => {
      const ids = Array.isArray(payload?.ids) ? payload.ids : [];
      const users = ids.map((id: any) => ({ id }));
      setOnlineUsers(users);
      log(`${backend} presence:online`, payload);
    });

    const unsubJoin = subscribePresenceJoin((payload: any) => {
      const id = toIdStr(payload?.userId ?? payload?.user_id ?? payload?.user);
      if (!id) return;

      setOnlineUsers((prev) => {
        const arr = Array.isArray(prev) ? prev : [];
        if (arr.some((x) => toIdStr(x) === id)) return arr;
        return [...arr, { id }];
      });
    });

    const unsubLeave = subscribePresenceLeave((payload: any) => {
      const id = toIdStr(payload?.userId ?? payload?.user_id ?? payload?.user);
      if (!id) return;

      setOnlineUsers((prev) => (Array.isArray(prev) ? prev.filter((x) => toIdStr(x) !== id) : []));
    });

    return () => {
      unsubConn();
      unsubOnline();
      unsubJoin();
      unsubLeave();
      setConnState("idle");
      setOnlineUsers([]);
    };
  }, [busKey, backend]);

  return { onlineUsers, connState } as const;
}