// chatApp-frontend/src/shared/ws/socketClient.ts
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

export type ChatMessagePayload = any;
export type ChatNotifyPayload = any;
export type TypingPayload = any;
export type PresencePayload = any;

export type BackendRealtimeKind = "node" | "django" | "reverb" | "none";

/* socket.io events */
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
  typing: (p: { roomId: string; isTyping: boolean }) => void;
};

type Sock = Socket<ServerToClientEvents, ClientToServerEvents>;

/* -------------------- module state -------------------- */

let _store: Store<RootState> | null = null;

// ✅ one socket per backend kind
let _nodeSocket: Sock | null = null;
let _djangoSocket: Sock | null = null;

// wire flags
let _nodeWired = false;
let _djangoWired = false;

// joined rooms cache
let _nodeJoinedRooms = new Set<string>();
let _djangoJoinedRooms = new Set<string>();

/* -------------------- subscribers -------------------- */

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

/* -------------------- store/token helpers -------------------- */

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

function getRealtimeKind(): BackendRealtimeKind {
  try {
    const raw = localStorage.getItem("backendChoice");
    const k = String(raw || "").trim().toLowerCase();
    if (k === "node") return "node";
    if (k === "django") return "django";
    if (k === "reverb") return "reverb";
    return "none";
  } catch {
    return "none";
  }
}

/* -------------------- config -------------------- */

function getNodeWsConfig() {
  const url = String(import.meta.env.VITE_NODE_WS_URL || "http://localhost:3000").replace(/\/+$/, "");
  const path = String(import.meta.env.VITE_NODE_WS_PATH || "/socket.io").trim();
  return { url, path };
}

function getDjangoWsConfig() {
  // ✅ with python-socketio backend, use http origin, not ws:// raw websocket url
  const url = String(import.meta.env.VITE_DJANGO_WS_URL || "http://localhost:8000").replace(/\/+$/, "");
  const path = String(import.meta.env.VITE_DJANGO_WS_PATH || "/socket.io").trim();
  return { url, path };
}

/* -------------------- common wire -------------------- */

function wireSocket(socket: Sock, kind: "node" | "django") {
  log(`wire ${kind} listeners once`);

  socket.on("chat:message", (p) => {
    log(`${kind} <= chat:message`, p);
    emitTo(_onChatMessage, p);
  });

  socket.on("chat:notify", (p) => {
    log(`${kind} <= chat:notify`, p);
    emitTo(_onChatNotify, p);
  });

  socket.on("typing_indicator", (p) => {
    log(`${kind} <= typing_indicator`, p);
    emitTo(_onTyping, p);
  });

  socket.on("typing", (p) => {
    log(`${kind} <= typing`, p);
    emitTo(_onTyping, p);
  });

  socket.on("presence:online", (p) => {
    log(`${kind} <= presence:online`, p);
    emitTo(_onPresenceOnline, p);
  });

  socket.on("presence:join", (p) => {
    log(`${kind} <= presence:join`, p);
    emitTo(_onPresenceJoin, p);
  });

  socket.on("presence:leave", (p) => {
    log(`${kind} <= presence:leave`, p);
    emitTo(_onPresenceLeave, p);
  });

  socket.on("connect", () => {
    emitConn("connected", { id: socket.id, kind });

    const rooms = kind === "node" ? _nodeJoinedRooms : _djangoJoinedRooms;
    for (const rid of rooms) {
      try {
        log(`${kind} re-join room`, { roomId: rid });
        socket.emit("room:join", { roomId: rid });
      } catch {}
    }
  });

  socket.on("disconnect", (reason) => {
    log(`${kind} disconnect event`, { reason });
    emitConn("disconnected", { reason, kind });
  });

  socket.on("connect_error", (e) => {
    emitConn("error", { message: e?.message || String(e), kind });
    log(`${kind} connect_error`, { msg: e?.message || String(e) });
  });
}

/* -------------------- create sockets -------------------- */

function createNodeSocket(): Sock {
  const { url, path } = getNodeWsConfig();
  const token = currentAuthToken();

  log("create node socket (no autoConnect)", { url, path, hasToken: Boolean(token) });

  const s = io(url, {
    path,
    transports: ["websocket"],
    auth: { token },
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionAttempts: 8,
  }) as Sock;

  if (!_nodeWired) {
    wireSocket(s, "node");
    _nodeWired = true;
  }

  return s;
}

function createDjangoSocket(): Sock {
  const { url, path } = getDjangoWsConfig();
  const token = currentAuthToken();

  log("create django socket (no autoConnect)", { url, path, hasToken: Boolean(token) });

  const s = io(url, {
    path,
    transports: ["websocket"],
    auth: { token },
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionAttempts: 8,
  }) as Sock;

  if (!_djangoWired) {
    wireSocket(s, "django");
    _djangoWired = true;
  }

  return s;
}

/* -------------------- getters -------------------- */

export function getOrCreateSocket(): Sock {
  const kind = getRealtimeKind();

  if (kind === "django") {
    if (_djangoSocket) return _djangoSocket;
    _djangoSocket = createDjangoSocket();
    return _djangoSocket;
  }

  if (_nodeSocket) return _nodeSocket;
  _nodeSocket = createNodeSocket();
  return _nodeSocket;
}

function getActiveSocket(): Sock | null {
  const kind = getRealtimeKind();
  if (kind === "django") return _djangoSocket || (_djangoSocket = createDjangoSocket());
  if (kind === "node") return _nodeSocket || (_nodeSocket = createNodeSocket());
  return null;
}

/* -------------------- connect/disconnect -------------------- */

export function connectSocketIfAuthed(reason = "connect_if_authed") {
  const token = currentAuthToken();
  if (!token) {
    log("skip connect (no token)", { reason });
    return false;
  }

  const kind = getRealtimeKind();
  const s = getActiveSocket();

  if (!s || (kind !== "node" && kind !== "django")) return false;

  try {
    (s as any).auth = { token };

    if (!s.connected) {
      log(`${kind} connect`, { reason });
      s.connect();
    }

    return true;
  } catch (e: any) {
    log(`${kind} connect failed`, e?.message);
    return false;
  }
}

export function disconnectSocket(reason = "manual_disconnect") {
  const kind = getRealtimeKind();
  const s = getActiveSocket();

  if (!s) return;

  try {
    log(`${kind} disconnect`, { reason });
    s.disconnect();
  } catch {}
}

export function hardResetSocket(reason = "hard_reset") {
  if (_nodeSocket) {
    try {
      log("hardReset node", { reason });
      _nodeSocket.removeAllListeners();
      _nodeSocket.disconnect();
    } catch {}
  }

  if (_djangoSocket) {
    try {
      log("hardReset django", { reason });
      _djangoSocket.removeAllListeners();
      _djangoSocket.disconnect();
    } catch {}
  }

  _nodeSocket = null;
  _djangoSocket = null;

  _nodeWired = false;
  _djangoWired = false;

  _nodeJoinedRooms = new Set();
  _djangoJoinedRooms = new Set();
}

export function refreshSocketAuth(reason = "auth_refresh") {
  const token = currentAuthToken();
  if (!token) {
    log("refreshAuth skip (no token)", { reason });
    return false;
  }

  const kind = getRealtimeKind();
  const s = getActiveSocket();

  if (!s || (kind !== "node" && kind !== "django")) return false;

  try {
    (s as any).auth = { token };
    log(`refreshAuth reconnect ${kind}`, { reason });

    if (s.connected) s.disconnect();
    s.connect();

    return true;
  } catch (e: any) {
    log(`refreshAuth failed ${kind}`, e?.message);
    return false;
  }
}

/* -------------------- emits -------------------- */

export function emitRoomJoin({ roomId }: RoomJoinLeavePayload) {
  const rid = roomId == null ? "" : String(roomId);
  if (!rid) return false;

  const kind = getRealtimeKind();
  const s = getActiveSocket();

  if (!s || !s.connected || (kind !== "node" && kind !== "django")) return false;

  if (kind === "node") _nodeJoinedRooms.add(rid);
  if (kind === "django") _djangoJoinedRooms.add(rid);

  log(`${kind} => room:join`, { roomId: rid, connected: s.connected });
  s.emit("room:join", { roomId: rid });
  return true;
}

export function emitRoomLeave({ roomId }: RoomJoinLeavePayload) {
  const rid = roomId == null ? "" : String(roomId);
  if (!rid) return false;

  const kind = getRealtimeKind();
  const s = getActiveSocket();

  if (kind === "node") _nodeJoinedRooms.delete(rid);
  if (kind === "django") _djangoJoinedRooms.delete(rid);

  if (!s || !s.connected || (kind !== "node" && kind !== "django")) return false;

  s.emit("room:leave", { roomId: rid });
  return true;
}

export function emitTypingIndicator({ roomId, isTyping }: TypingEmitPayload) {
  const rid = roomId == null ? "" : String(roomId);
  if (!rid) return false;

  const kind = getRealtimeKind();
  const s = getActiveSocket();

  if (!s || !s.connected || (kind !== "node" && kind !== "django")) return false;

  log(`${kind} => typing_indicator`, {
    roomId: rid,
    isTyping: Boolean(isTyping),
    connected: s.connected,
  });

  s.emit("typing_indicator", { roomId: rid, isTyping: Boolean(isTyping) });
  return true;
}

/* -------------------- subscribe API -------------------- */

export function subscribeChatMessage(fn?: (p: ChatMessagePayload) => void) {
  return addSub(_onChatMessage, fn);
}

export function subscribeChatNotify(fn?: (p: ChatNotifyPayload) => void) {
  return addSub(_onChatNotify, fn);
}

export function subscribeTyping(fn?: (p: TypingPayload) => void) {
  return addSub(_onTyping, fn);
}

export function subscribePresenceOnline(fn?: (p: PresencePayload) => void) {
  return addSub(_onPresenceOnline, fn);
}

export function subscribePresenceJoin(fn?: (p: PresencePayload) => void) {
  return addSub(_onPresenceJoin, fn);
}

export function subscribePresenceLeave(fn?: (p: PresencePayload) => void) {
  return addSub(_onPresenceLeave, fn);
}

export function subscribeConnState(fn?: (p: ConnEvent) => void) {
  return addSub(_onConnState, fn);
}