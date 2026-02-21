// chatApp-frontend\src\shared\ws\socketClient.ts
import { io, type Socket } from "socket.io-client";
import type { Store } from "@reduxjs/toolkit";
import type { RootState } from "@/app/store/store";

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";
const log = (...a: any[]) => DEBUG && console.log("[socketClient]", ...a);

/* -------------------- types -------------------- */

export type ConnState = "connected" | "disconnected" | "error";

export type ConnEvent = {
  state: ConnState;
  meta: any | null;
};

export type RoomJoinLeavePayload = { roomId: string | number };
export type TypingEmitPayload = { roomId: string | number; isTyping: boolean };

// inbound payloads (می‌تونی بعداً دقیق‌ترشون کنی)
export type ChatMessagePayload = any;
export type ChatNotifyPayload = any;
export type TypingPayload = any;
export type PresencePayload = any;

/* socket.io events typing (soft) */
type ServerToClientEvents = {
  "chat:message": (p: ChatMessagePayload) => void;
  "chat:notify": (p: ChatNotifyPayload) => void;

  typing_indicator: (p: TypingPayload) => void;
  typing: (p: TypingPayload) => void;

  "presence:online": (p: PresencePayload) => void;
  "presence:join": (p: PresencePayload) => void;
  "presence:leave": (p: PresencePayload) => void;

  connect: () => void;
  disconnect: (reason: string) => void;
  connect_error: (err: any) => void;
};

type ClientToServerEvents = {
  "room:join": (p: { roomId: string }) => void;
  "room:leave": (p: { roomId: string }) => void;
  typing_indicator: (p: { roomId: string; isTyping: boolean }) => void;
};

type Sock = Socket<ServerToClientEvents, ClientToServerEvents>;

/* -------------------- module state -------------------- */

let _store: Store<RootState> | null = null;
let _socket: Sock | null = null;
let _wired = false;

// subscriber sets
const _onChatMessage = new Set<(p: ChatMessagePayload) => void>();
const _onChatNotify = new Set<(p: ChatNotifyPayload) => void>();
const _onTyping = new Set<(p: TypingPayload) => void>();
const _onPresenceOnline = new Set<(p: PresencePayload) => void>();
const _onPresenceJoin = new Set<(p: PresencePayload) => void>();
const _onPresenceLeave = new Set<(p: PresencePayload) => void>();
const _onConnState = new Set<(p: ConnEvent) => void>();

function addSub<T>(set: Set<(p: T) => void>, fn?: ((p: T) => void) | null) {
  if (typeof fn !== "function") return () => {};
  set.add(fn);
  return () => set.delete(fn);
}

function emitTo<T>(set: Set<(p: T) => void>, payload: T) {
  for (const fn of set) {
    try {
      fn(payload);
    } catch (e) {
      console.error("[socketClient] subscriber error", e);
    }
  }
}

function emitConn(state: ConnState, meta?: any) {
  emitTo(_onConnState, { state, meta: meta || null });
}

export function attachWsStore(store: Store<RootState>) {
  _store = store;
}

function getToken(): string | null {
  try {
    return _store?.getState?.().auth?.access_token || null;
  } catch {
    return null;
  }
}

function stripBearer(t: unknown): string {
  return String(t || "").replace(/^Bearer\s+/i, "").trim();
}

function currentAuthToken(): string {
  return stripBearer(getToken());
}

function getWsConfig() {
  const url = String(import.meta.env.VITE_NODE_WS_URL || "http://localhost:3000").replace(/\/+$/, "");
  const path = String(import.meta.env.VITE_NODE_WS_PATH || "/socket.io").trim();
  return { url, path };
}

function ensureWired(socket: Sock) {
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
function createSocket(): Sock {
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
  }) as Sock;

  ensureWired(s);
  return s;
}

export function getOrCreateSocket(): Sock {
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
    (s as any).auth = { token };
    if (!s.connected) {
      log("connect", { reason });
      s.connect();
    }
    return true;
  } catch (e: any) {
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
    (s as any).auth = { token };
    log("refreshAuth reconnect", { reason });

    if (s.connected) s.disconnect();
    s.connect();
    return true;
  } catch (e: any) {
    log("refreshAuth failed", e?.message);
    return false;
  }
}

/* -------------------- emits (require connection) -------------------- */

export function emitRoomJoin({ roomId }: RoomJoinLeavePayload) {
  const s = getOrCreateSocket();
  if (!s.connected) return false;

  const rid = roomId == null ? "" : String(roomId);
  if (!rid) return false;

  s.emit("room:join", { roomId: rid });
  return true;
}

export function emitRoomLeave({ roomId }: RoomJoinLeavePayload) {
  const s = getOrCreateSocket();
  if (!s.connected) return false;

  const rid = roomId == null ? "" : String(roomId);
  if (!rid) return false;

  s.emit("room:leave", { roomId: rid });
  return true;
}

export function emitTypingIndicator({ roomId, isTyping }: TypingEmitPayload) {
  const s = getOrCreateSocket();
  if (!s.connected) return false;

  const rid = roomId == null ? "" : String(roomId);
  if (!rid) return false;

  s.emit("typing_indicator", { roomId: rid, isTyping: Boolean(isTyping) });
  return true;
}

/* -------------------- subscribe API (does not connect) -------------------- */

export function subscribeChatMessage(fn?: (p: ChatMessagePayload) => void) {
  getOrCreateSocket();
  return addSub(_onChatMessage, fn);
}
export function subscribeChatNotify(fn?: (p: ChatNotifyPayload) => void) {
  getOrCreateSocket();
  return addSub(_onChatNotify, fn);
}
export function subscribeTyping(fn?: (p: TypingPayload) => void) {
  getOrCreateSocket();
  return addSub(_onTyping, fn);
}
export function subscribePresenceOnline(fn?: (p: PresencePayload) => void) {
  getOrCreateSocket();
  return addSub(_onPresenceOnline, fn);
}
export function subscribePresenceJoin(fn?: (p: PresencePayload) => void) {
  getOrCreateSocket();
  return addSub(_onPresenceJoin, fn);
}
export function subscribePresenceLeave(fn?: (p: PresencePayload) => void) {
  getOrCreateSocket();
  return addSub(_onPresenceLeave, fn);
}
export function subscribeConnState(fn?: (p: ConnEvent) => void) {
  getOrCreateSocket();
  return addSub(_onConnState, fn);
}