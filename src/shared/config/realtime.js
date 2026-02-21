// src/shared/config/realtime.js
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import apiClient from "@/shared/api/apiClient";

// ✅ redux actions (NO wsConnState)
import { wsConnected, wsDisconnected, wsError } from "@/app/store/wsActions";

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_WS_DEBUG_LEVEL || "0") !== "0";
const log = (...a) => DEBUG && console.log("[realtime]", ...a);

let _echo = null;
let _tokenKey = null;

// ✅ store hook (like apiClient)
let _store = null;
export function attachRealtimeStore(store) {
  _store = store;
}

function dispatchSafe(action) {
  try {
    _store?.dispatch?.(action);
  } catch {}
}

function stripBearer(t) {
  return String(t || "").replace(/^Bearer\s+/i, "").trim();
}

function envBool(v) {
  return String(v).toLowerCase() === "true";
}

function getCfg() {
  return {
    key: import.meta.env.VITE_PUSHER_KEY || "local",
    cluster: import.meta.env.VITE_PUSHER_CLUSTER || "mt1",
    wsHost: import.meta.env.VITE_PUSHER_HOST || "127.0.0.1",
    wsPort: Number(import.meta.env.VITE_PUSHER_PORT || 8080),
    forceTLS: envBool(import.meta.env.VITE_PUSHER_TLS),
    authEndpoint:
      import.meta.env.VITE_PUSHER_AUTH_ENDPOINT ||
      "http://localhost:8000/api/broadcasting/auth",
  };
}

// ✅ keep connection bindings to unbind later
let _conn = null;
let _bound = { state_change: null, connected: null, disconnected: null, error: null };

function unbindConnState() {
  if (!_conn) return;

  try { _conn.unbind?.("state_change", _bound.state_change); } catch {}
  try { _conn.unbind?.("connected", _bound.connected); } catch {}
  try { _conn.unbind?.("disconnected", _bound.disconnected); } catch {}
  try { _conn.unbind?.("error", _bound.error); } catch {}

  _conn = null;
  _bound = { state_change: null, connected: null, disconnected: null, error: null };
}

function bindConnState(echo) {
  const conn = echo?.connector?.pusher?.connection;
  if (!conn || !conn.bind) return;

  unbindConnState();
  _conn = conn;

  const onStateChange = (s) => {
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

  const onError = (err) => {
    const payload = err?.error || err || { message: "Unknown pusher error" };
    log("pusher error", payload);
    dispatchSafe(wsError(payload));
  };

  _bound.state_change = onStateChange;
  _bound.connected = onConnected;
  _bound.disconnected = onDisconnected;
  _bound.error = onError;

  try { conn.bind("state_change", onStateChange); } catch {}
  try { conn.bind("connected", onConnected); } catch {}
  try { conn.bind("disconnected", onDisconnected); } catch {}
  try { conn.bind("error", onError); } catch {}

  // snapshot اولیه
  try {
    if (conn.state === "connected") dispatchSafe(wsConnected());
  } catch {}
}

export function destroyEcho(reason = "destroy") {
  if (!_echo) return;

  try {
    log("destroyEcho", { reason });

    // ✅ update redux state too
    dispatchSafe(wsDisconnected());

    unbindConnState();
    _echo.disconnect();
  } catch {}

  _echo = null;
  _tokenKey = null;
}

// ✅ this is what useUserEvents needs
export function getOrCreateEcho(accessToken) {
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

  // لازم برای laravel-echo
  window.Pusher = Pusher;

  log("create Echo", {
    wsHost: cfg.wsHost,
    wsPort: cfg.wsPort,
    forceTLS: cfg.forceTLS,
    authEndpoint: cfg.authEndpoint,
  });

  try {
    _echo = new Echo({
  broadcaster: "pusher",
  key: cfg.key,
  cluster: cfg.cluster,

  wsHost: cfg.wsHost,
  wsPort: cfg.wsPort,
  wssPort: cfg.wsPort,
  forceTLS: cfg.forceTLS,
  enabledTransports: ["ws", "wss"],

  authEndpoint: cfg.authEndpoint,

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

    // ✅ bind pusher connection events to redux
    bindConnState(_echo);

    return _echo;
  } catch (e) {
    const payload = { message: e?.message || String(e) };
    dispatchSafe(wsError(payload));
    log("Echo create failed", payload);

    _echo = null;
    _tokenKey = null;

    dispatchSafe(wsDisconnected());
    return null;
  }
}
