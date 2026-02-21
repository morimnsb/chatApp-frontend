// chatApp-frontend\src\features\chat\hooks\usePresence.ts
import { useEffect, useMemo, useState } from "react";
import { getOrCreateEcho } from "@/shared/config/realtime"; // ✅ اگر realtime.ts شد

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";
const log = (...a: any[]) => DEBUG && console.log("[usePresence]", ...a);

const PRESENCE_NAME_REVERB = "global";
const PRESENCE_NAME_NODE = "presence.global";

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

function buildWsUrlFromApiBase(apiBase: unknown, token: unknown): string {
  const base = String(apiBase || "").replace(/\/+$/, "");
  const httpBase = base.endsWith("/api") ? base.slice(0, -4) : base;
  const wsBase = httpBase.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
  return `${wsBase}/ws?token=${encodeURIComponent(String(token || ""))}`;
}

/* -------------------- Node WS message types -------------------- */

type NodeWsBase = { type: string; [k: string]: any };

type NodeSubscribed = { type: "subscribed"; roomId: string };
type NodePresenceHere = { type: "presence_here"; room: string; users: PresenceUser[] };
type NodePresenceJoin = { type: "presence_join"; room: string; user: PresenceUser };
type NodePresenceLeave = { type: "presence_leave"; room: string; user: PresenceUser };

type NodeWsMsg = NodeSubscribed | NodePresenceHere | NodePresenceJoin | NodePresenceLeave | NodeWsBase;

function parseNodeMsg(raw: unknown): NodeWsMsg | null {
  try {
    const obj = JSON.parse(String((raw as any)?.data ?? raw ?? ""));
    if (!obj || typeof obj !== "object") return null;
    return obj as NodeWsMsg;
  } catch {
    return null;
  }
}

export function usePresence({ backendKind, token, currentUserId }: UsePresenceArgs = {}) {
  const backend = String(backendKind || "").toLowerCase() as PresenceBackendKind;
  const isReverb = backend === "reverb";
  const isNode = backend === "node";

  const hasToken = Boolean(token);
  const hasUser = Number(currentUserId) > 0;

  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [connState, setConnState] = useState<ConnState>("unknown");

  // ---------- Reverb key ----------
  const key = useMemo(() => {
    if (!isReverb || !hasToken || !hasUser) return null;
    const tk = String(token).slice(0, 18);
    return `reverb|presence|${currentUserId}|${tk}`;
  }, [isReverb, hasToken, hasUser, currentUserId, token]);

  // ---------- Node key ----------
  const nodeKey = useMemo(() => {
    if (!isNode || !hasToken || !hasUser) return null;
    const tk = String(token).slice(0, 18);
    return `node|presence|${currentUserId}|${tk}`;
  }, [isNode, hasToken, hasUser, currentUserId, token]);

  /* ===================== Reverb (Echo Presence) ===================== */

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
        log("here ✅", { count: arr.length });
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
      log("presence joined ✅", { name: PRESENCE_NAME_REVERB });
    } catch (e) {
      log("presence join failed", e);
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

  /* ===================== Node WS Presence ===================== */

  useEffect(() => {
    if (!nodeKey) return;

    const API = String((import.meta.env as any).VITE_API_URL_NODE || "").replace(/\/+$/, "");
    if (!API) {
      setConnState("error-missing-api");
      return;
    }

    setOnlineUsers([]);
    setConnState("connecting");

    const wsUrl = buildWsUrlFromApiBase(API, token);
    log("[node] presence connecting", { wsUrl });

    const ws = new WebSocket(wsUrl);

    const sendJson = (obj: unknown) => {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
      } catch {}
    };

    ws.onopen = () => {
      setConnState("subscribing");
      sendJson({ type: "subscribe", roomId: PRESENCE_NAME_NODE });
      log("[node] presence subscribe ->", PRESENCE_NAME_NODE);
    };

    ws.onmessage = (ev) => {
      const data = parseNodeMsg(ev);
      if (!data) return;

      if (data.type === "subscribed" && String((data as any).roomId) === PRESENCE_NAME_NODE) {
        setConnState("connected");
        return;
      }

      if (data.type === "presence_here" && String((data as any).room) === PRESENCE_NAME_NODE) {
        const users = Array.isArray((data as any).users) ? ((data as any).users as PresenceUser[]) : [];
        setOnlineUsers(users);
        log("[node] presence_here", { count: users.length });
        return;
      }

      if (data.type === "presence_join" && String((data as any).room) === PRESENCE_NAME_NODE) {
        const u = (data as any).user as PresenceUser;
        const id = toIdStr(u);
        if (!id) return;

        setOnlineUsers((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          if (arr.some((x) => toIdStr(x) === id)) return arr;
          return [...arr, u];
        });
        return;
      }

      if (data.type === "presence_leave" && String((data as any).room) === PRESENCE_NAME_NODE) {
        const u = (data as any).user as PresenceUser;
        const id = toIdStr(u);
        if (!id) return;

        setOnlineUsers((prev) => (Array.isArray(prev) ? prev.filter((x) => toIdStr(x) !== id) : []));
        return;
      }
    };

    ws.onerror = () => setConnState("error");
    ws.onclose = () => setConnState("idle");

    return () => {
      try {
        ws.close();
      } catch {}
      setConnState("idle");
      setOnlineUsers([]);
    };
  }, [nodeKey, token]);

  return { onlineUsers, connState } as const;
}