// src/shared/config/realtime.ts
import Echo from "laravel-echo";
import Pusher from "pusher-js";

import { wsConnected, wsDisconnected, wsError } from "@/app/store/wsActions";
import type { AppDispatch } from "@/app/store/store";

import apiClient, { type AppAxiosRequestConfig } from "@/shared/api/apiClient";

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_WS_DEBUG_LEVEL || "0") !== "0";
const log = (...a: any[]) => DEBUG && console.log("[realtime]", ...a);

type WsErrorPayload = Record<string, any>;

type StoreLike = { dispatch: AppDispatch };

let _echo: any | null = null;
let _tokenKey: string | null = null;

let _store: StoreLike | null = null;
export function attachRealtimeStore(store: StoreLike) {
  _store = store;
}

function dispatchSafe(action: any) {
  try {
    _store?.dispatch?.(action);
  } catch {}
}

function stripBearer(t: unknown): string {
  return String(t || "").replace(/^Bearer\s+/i, "").trim();
}

function envBool(v: unknown): boolean {
  return String(v).toLowerCase() === "true";
}

function getCfg() {
  return {
    key: (import.meta.env as any).VITE_PUSHER_KEY || "local",
    cluster: (import.meta.env as any).VITE_PUSHER_CLUSTER || "mt1",
    wsHost: (import.meta.env as any).VITE_PUSHER_HOST || "127.0.0.1",
    wsPort: Number((import.meta.env as any).VITE_PUSHER_PORT || 8080),
    forceTLS: envBool((import.meta.env as any).VITE_PUSHER_TLS),
    // ✅ keep default, but authorizer below will call relative "/broadcasting/auth"
    authEndpoint:
      (import.meta.env as any).VITE_PUSHER_AUTH_ENDPOINT ||
      "http://localhost:8000/api/broadcasting/auth",
  };
}

let _conn: any | null = null;
let _bound: {
  state_change: ((s: any) => void) | null;
  connected: (() => void) | null;
  disconnected: (() => void) | null;
  error: ((err: any) => void) | null;
} = { state_change: null, connected: null, disconnected: null, error: null };

function unbindConnState() {
  if (!_conn) return;

  try {
    _conn.unbind?.("state_change", _bound.state_change);
  } catch {}
  try {
    _conn.unbind?.("connected", _bound.connected);
  } catch {}
  try {
    _conn.unbind?.("disconnected", _bound.disconnected);
  } catch {}
  try {
    _conn.unbind?.("error", _bound.error);
  } catch {}

  _conn = null;
  _bound = { state_change: null, connected: null, disconnected: null, error: null };
}

function bindConnState(echo: any) {
  const conn = echo?.connector?.pusher?.connection;
  if (!conn || !conn.bind) return;

  unbindConnState();
  _conn = conn;

  const onStateChange = (s: any) => {
    const current = s?.current || "unknown";
    const previous = s?.previous || "unknown";
    log("pusher state_change", { previous, current });

    if (current === "connected") dispatchSafe(wsConnected());
    if (current === "disconnected" || current === "unavailable" || current === "failed") {
      dispatchSafe(wsDisconnected());
    }
  };

  const onConnected = () => {
    log("pusher connected");
    dispatchSafe(wsConnected());
  };

  const onDisconnected = () => {
    log("pusher disconnected");
    dispatchSafe(wsDisconnected());
  };

  const onError = (err: any) => {
    const payload: WsErrorPayload = err?.error || err || { message: "Unknown pusher error" };

    const msg =
      typeof payload === "string"
        ? payload
        : String(payload?.message || payload?.error?.message || "Unknown pusher error");

    log("pusher error", payload);
    dispatchSafe(wsError(msg));
  };

  _bound.state_change = onStateChange;
  _bound.connected = onConnected;
  _bound.disconnected = onDisconnected;
  _bound.error = onError;

  try {
    conn.bind("state_change", onStateChange);
  } catch {}
  try {
    conn.bind("connected", onConnected);
  } catch {}
  try {
    conn.bind("disconnected", onDisconnected);
  } catch {}
  try {
    conn.bind("error", onError);
  } catch {}

  try {
    if (conn.state === "connected") dispatchSafe(wsConnected());
  } catch {}
}

export function destroyEcho(reason: string = "destroy") {
  if (!_echo) return;

  try {
    log("destroyEcho", { reason });
    dispatchSafe(wsDisconnected());
    unbindConnState();
    _echo.disconnect();
  } catch {}

  _echo = null;
  _tokenKey = null;
}

export function getOrCreateEcho(accessToken: unknown): any | null {
  const token = stripBearer(accessToken);

  if (!token) {
    log("getOrCreateEcho: missing token");
    dispatchSafe(wsDisconnected());
    return null;
  }

  const cfg = getCfg();

  const nextTokenKey = token.slice(0, 16);
  if (_echo && _tokenKey === nextTokenKey) return _echo;

  if (_echo) destroyEcho("token-changed");

  (window as any).Pusher = Pusher;

  log("create Echo", {
    wsHost: cfg.wsHost,
    wsPort: cfg.wsPort,
    forceTLS: cfg.forceTLS,
    authEndpoint: cfg.authEndpoint,
    tokenKey: nextTokenKey,
  });

  try {
    _echo = new (Echo as any)({
      broadcaster: "pusher",
      key: cfg.key,
      cluster: cfg.cluster,

      wsHost: cfg.wsHost,
      wsPort: cfg.wsPort,
      wssPort: cfg.wsPort,
      forceTLS: cfg.forceTLS,
      enabledTransports: ["ws", "wss"],
      disableStats: true,

      // still ok to keep:
      authEndpoint: cfg.authEndpoint,

      // ✅ ENTERPRISE: force auth via YOUR apiClient interceptors (adds Bearer)
      authorizer: (channel: any) => ({
        authorize: (socketId: string, callback: (err: any, data: any) => void) => {
          const config: AppAxiosRequestConfig = {
            hasAuth: true,
            headers: {
              Accept: "application/json",
              "X-Requested-With": "XMLHttpRequest",
            },
          };

          apiClient
            // ✅ relative path => baseURL is chosen by backendChoice (reverb)
            .post("/broadcasting/auth", { socket_id: socketId, channel_name: channel.name }, config)
            .then((res) => callback(null, res.data))
            .catch((err) => callback(err, null));
        },
      }),

      // keep as fallback (some versions read this)
      auth: {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json",
        },
      },

      withCredentials: false,
    });

    _tokenKey = nextTokenKey;

    bindConnState(_echo);

    return _echo;
  } catch (e: any) {
    const payload: WsErrorPayload = { message: e?.message || String(e) };
    const msg = String(payload.message || "Echo create failed");

    dispatchSafe(wsError(msg));
    log("Echo create failed", payload);

    _echo = null;
    _tokenKey = null;

    dispatchSafe(wsDisconnected());
    return null;
  }
}


// ✅ WS-only typing via Echo whisper (no HTTP)
export function whisperTyping(roomId: number, payload: any): boolean {
  try {
    if (!_echo || !roomId) return false;
    const ch = _echo.private(`chat.${roomId}`);
    ch.whisper("typing", payload);
    return true;
  } catch {
    return false;
  }
}