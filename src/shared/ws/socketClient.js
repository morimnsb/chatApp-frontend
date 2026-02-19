// chatApp-frontend/src/shared/ws/socketClient.js
import { io } from "socket.io-client";

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";
const log = (...a) => DEBUG && console.log("[socketClient]", ...a);

let _store = null;
let _socket = null;
let _wired = false;

const _onChatMessage = new Set();
const _onChatNotify = new Set();
const _onTyping = new Set();
const _onPresenceOnline = new Set();
const _onPresenceJoin = new Set();
const _onPresenceLeave = new Set();
const _onConnState = new Set();

function addSub(set, fn) {
  if (typeof fn !== "function") return () => {};
  set.add(fn);
  return () => set.delete(fn);
}
function emitTo(set, payload) {
  for (const fn of set) {
    try {
      fn(payload);
    } catch (e) {
      console.error("[socketClient] subscriber error", e);
    }
  }
}
function emitConn(state, meta) {
  emitTo(_onConnState, { state, meta: meta || null });
}

export function attachWsStore(store) {
  _store = store;
}

function getToken() {
  try {
    return _store?.getState?.().auth?.access_token || null;
  } catch {
    return null;
  }
}
function stripBearer(t) {
  return String(t || "").replace(/^Bearer\s+/i, "").trim();
}
function currentAuthToken() {
  return stripBearer(getToken());
}

function getWsConfig() {
  const url = String(import.meta.env.VITE_NODE_WS_URL || "http://localhost:3000").replace(/\/+$/, "");
  const path = String(import.meta.env.VITE_NODE_WS_PATH || "/socket.io").trim();
  return { url, path };
}

function ensureWired(socket) {
  if (!socket || _wired) return;
  _wired = true;

  log("wire listeners once");

  socket.on("chat:message", (p) => emitTo(_onChatMessage, p));
  socket.on("chat:notify", (p) => emitTo(_onChatNotify, p));

  socket.on("typing_indicator", (p) => emitTo(_onTyping, p));
  socket.on("typing", (p) => emitTo(_onTyping, p));

  socket.on("presence:online", (p) => emitTo(_onPresenceOnline, p));
  socket.on("presence:join", (p) => emitTo(_onPresenceJoin, p));
  socket.on("presence:leave", (p) => emitTo(_onPresenceLeave, p));

  socket.on("connect", () => emitConn("connected", { id: socket.id }));
  socket.on("disconnect", (reason) => emitConn("disconnected", { reason }));

  socket.on("connect_error", (e) => {
    emitConn("error", { message: e?.message || String(e) });
    log("connect_error", { msg: e?.message || String(e) });
  });
}

// ✅ create socket but DO NOT connect yet
function createSocket() {
  const { url, path } = getWsConfig();
  const token = currentAuthToken();

  log("create (no autoConnect)", { url, path, hasToken: Boolean(token) });

  const s = io(url, {
    path,
    transports: ["websocket"],
    auth: { token },
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionAttempts: 8,
  });

  ensureWired(s);
  return s;
}

export function getOrCreateSocket() {
  if (_socket) return _socket;
  _socket = createSocket();
  return _socket;
}

// ✅ only connect when authenticated
export function connectSocketIfAuthed(reason = "connect_if_authed") {
  const token = currentAuthToken();
  if (!token) {
    log("skip connect (no token)", { reason });
    return false;
  }

  const s = getOrCreateSocket();
  try {
    s.auth = { token };
    if (!s.connected) {
      log("connect", { reason });
      s.connect();
    }
    return true;
  } catch (e) {
    log("connect failed", e?.message);
    return false;
  }
}

export function disconnectSocket(reason = "manual_disconnect") {
  if (!_socket) return;
  try {
    log("disconnect", { reason });
    _socket.disconnect();
  } catch {}
}

export function hardResetSocket(reason = "hard_reset") {
  if (!_socket) return;
  try {
    log("hardReset", { reason });
    _socket.removeAllListeners();
    _socket.disconnect();
  } catch {}
  _socket = null;
  _wired = false;
}

export function refreshSocketAuth(reason = "auth_refresh") {
  const token = currentAuthToken();
  const s = getOrCreateSocket();

  if (!token) {
    log("refreshAuth skip (no token)", { reason });
    return false;
  }

  try {
    s.auth = { token };
    log("refreshAuth reconnect", { reason });

    if (s.connected) s.disconnect();
    s.connect();
    return true;
  } catch (e) {
    log("refreshAuth failed", e?.message);
    return false;
  }
}

// emits (require connection)
export function emitRoomJoin({ roomId }) {
  const s = getOrCreateSocket();
  if (!s.connected) return false;
  const rid = roomId == null ? null : String(roomId);
  if (!rid) return false;
  s.emit("room:join", { roomId: rid });
  return true;
}

export function emitRoomLeave({ roomId }) {
  const s = getOrCreateSocket();
  if (!s.connected) return false;
  const rid = roomId == null ? null : String(roomId);
  if (!rid) return false;
  s.emit("room:leave", { roomId: rid });
  return true;
}

export function emitTypingIndicator({ roomId, isTyping }) {
  const s = getOrCreateSocket();
  if (!s.connected) return false;
  const rid = roomId == null ? null : String(roomId);
  if (!rid) return false;
  s.emit("typing_indicator", { roomId: rid, isTyping: Boolean(isTyping) });
  return true;
}

// ✅ Subscribe API DOES NOT connect anymore
export function subscribeChatMessage(fn) {
  getOrCreateSocket();
  return addSub(_onChatMessage, fn);
}
export function subscribeChatNotify(fn) {
  getOrCreateSocket();
  return addSub(_onChatNotify, fn);
}
export function subscribeTyping(fn) {
  getOrCreateSocket();
  return addSub(_onTyping, fn);
}
export function subscribePresenceOnline(fn) {
  getOrCreateSocket();
  return addSub(_onPresenceOnline, fn);
}
export function subscribePresenceJoin(fn) {
  getOrCreateSocket();
  return addSub(_onPresenceJoin, fn);
}
export function subscribePresenceLeave(fn) {
  getOrCreateSocket();
  return addSub(_onPresenceLeave, fn);
}
export function subscribeConnState(fn) {
  getOrCreateSocket();
  return addSub(_onConnState, fn);
}
