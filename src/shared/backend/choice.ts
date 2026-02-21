// chatApp-frontend\src\shared\backend\choice.ts
import { useCallback, useMemo, useState } from "react";

/* -------------------- constants -------------------- */

export const BACKEND_KEY = "backendChoice" as const;

// ✅ چون الان پروژه‌ات روی node هست:
export const DEFAULT_BACKEND = "node" as const;

type WsEcho = { kind: "echo" };
type WsSocketIo = {
  kind: "socketio";
  urlEnvKey: string;
  pathEnvKey: string;
  defaultWsUrl: string;
  defaultWsPath: string;
};
type WsRaw = {
  kind: "raw";
  wsEnvKey: string;
  defaultWsBase: string;
  tokenParam?: string;
};
type WsNone = { kind?: "none" } | { kind: "none" };

type WsConfig = WsEcho | WsSocketIo | WsRaw | WsNone;

type BackendPaths = {
  convos: string | null;
  rooms: string | null;
  users: string | null;
  friend: string | null;
  me: string | null;
  makeContact: string | null;
  firstMessage: string | null;
  roomMessages: ((roomId: string | number) => string) | null;
};

type BackendConfig = {
  key: string;
  label: string;
  apiBaseEnvKeys: readonly string[];
  defaultApiBase: string;
  paths: BackendPaths;
  ws: WsConfig;
};

export const BACKEND_REGISTRY = {
  reverb: {
    key: "reverb",
    label: "Laravel + Reverb (real-time)",
    apiBaseEnvKeys: ["VITE_API_BASE_REVERB", "REACT_APP_API_BASE_REVERB"],
    defaultApiBase: "http://localhost:8000/api",
    paths: {
      convos: "/chat/conversations/",
      rooms: "/chat/chatrooms/",
      users: "/auth/users/",
      friend: "/chat/friendship",
      me: "/auth/me",
      makeContact: "/chat/make-contact",
      firstMessage: "/chat/make-contact",
      roomMessages: (roomId: string | number) => `/chat/messages/${roomId}/`,
    },
    ws: { kind: "echo" } as const,
  },

  node: {
    key: "node",
    label: "Node.js (Express)",
    apiBaseEnvKeys: ["VITE_API_BASE_NODE", "REACT_APP_API_BASE_NODE"],
    defaultApiBase: "http://localhost:3000/api",
    paths: {
      convos: "/chat/conversations/",
      rooms: "/chat/conversations/", // alias rooms -> convos
      users: "/auth/users/",
      friend: "/chat/friendship/",
      me: "/auth/me",
      makeContact: "/chat/make-contact/",
      firstMessage: "/chat/make-contact/",
      roomMessages: (roomId: string | number) => `/chat/messages/${roomId}/`,
    },
    ws: {
      kind: "socketio",
      urlEnvKey: "VITE_NODE_WS_URL",
      pathEnvKey: "VITE_NODE_WS_PATH",
      defaultWsUrl: "http://localhost:3000",
      defaultWsPath: "/socket.io",
    } as const,
  },

  nest: {
    key: "nest",
    label: "NestJS",
    apiBaseEnvKeys: ["VITE_API_BASE_NEST", "REACT_APP_API_BASE_NEST"],
    defaultApiBase: "http://localhost:9100/api",
    paths: {
      convos: "/chat/conversations/",
      rooms: "/chat/rooms/",
      users: "/auth/users/",
      friend: "/chat/friendship/",
      me: "/auth/me",
      makeContact: "/chat/make-contact/",
      firstMessage: "/chat/make-contact/",
      roomMessages: (roomId: string | number) => `/chat/messages/${roomId}/`,
    },
    ws: {
      kind: "socketio",
      urlEnvKey: "VITE_NEST_WS_URL",
      pathEnvKey: "VITE_NEST_WS_PATH",
      defaultWsUrl: "http://localhost:9100",
      defaultWsPath: "/socket.io",
    } as const,
  },

  django: {
    key: "django",
    label: "Django",
    apiBaseEnvKeys: ["VITE_API_BASE_DJANGO", "REACT_APP_API_BASE_DJANGO"],
    defaultApiBase: "http://localhost:8001/api",
    paths: {
      convos: "/chat/conversations/",
      rooms: "/chat/rooms/",
      users: "/auth/users/",
      friend: "/chat/friendship/",
      me: "/auth/me",
      makeContact: null,
      firstMessage: null,
      roomMessages: (roomId: string | number) => `/chat/messages/${roomId}/`,
    },
    ws: {
      kind: "raw",
      wsEnvKey: "VITE_WS_URL_DJANGO",
      defaultWsBase: "ws://localhost:8001/ws/chat/",
      tokenParam: "token",
    } as const,
  },

  fastapi: {
    key: "fastapi",
    label: "FastAPI",
    apiBaseEnvKeys: ["VITE_API_BASE_FASTAPI", "REACT_APP_API_BASE_FASTAPI"],
    defaultApiBase: "http://localhost:8002/api",
    paths: {
      convos: "/chat/conversations/",
      rooms: "/chat/rooms/",
      users: "/auth/users/",
      friend: "/chat/friendship/",
      me: "/auth/me",
      makeContact: null,
      firstMessage: null,
      roomMessages: (roomId: string | number) => `/chat/messages/${roomId}/`,
    },
    ws: {
      kind: "raw",
      wsEnvKey: "VITE_WS_URL_FASTAPI",
      defaultWsBase: "ws://localhost:8002/ws/chat/",
      tokenParam: "token",
    } as const,
  },
} satisfies Record<string, BackendConfig>;

export type BackendKey = keyof typeof BACKEND_REGISTRY;

// ✅ درست و type-safe (نه string[])
export const BACKENDS = Object.keys(BACKEND_REGISTRY) as BackendKey[];

/* -------------------- safe localStorage -------------------- */

function safeGetItem(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage?.setItem(key, value);
  } catch {}
}

/* -------------------- env reader -------------------- */

function env(key: string, fallback: string | undefined = undefined): string | undefined {
  return ((import.meta as any).env && (import.meta as any).env[key]) ?? fallback;
}

/* -------------------- sanitize base URLs -------------------- */

function normalizeBase(val: unknown, fallback: string): string {
  const v = String(val ?? "").trim();
  if (!v || v === "/" || /^(false|null|undefined|0)$/i.test(v)) {
    return String(fallback).replace(/\/+$/, "");
  }
  return v.replace(/\/+$/, "");
}

/* -------------------- join base + path -------------------- */

function joinPath(base: string, path: string): string {
  const b = String(base ?? "").replace(/\/+$/, "");
  const p = String(path ?? "").replace(/^\/+/, "");
  return b ? `${b}/${p}` : `/${p}`;
}

/* -------------------- key helpers -------------------- */

function isValidBackendKey(k: unknown): k is BackendKey {
  const kk = String(k ?? "").toLowerCase();
  return Boolean((BACKEND_REGISTRY as any)[kk]);
}

function pickEnvBase(keys: readonly string[], fallback: string): string {
  for (const k of keys || []) {
    const v = env(k);
    if (v != null && String(v).trim() !== "") return normalizeBase(v, fallback);
  }
  return normalizeBase(undefined, fallback);
}

/* -------------------- default backend -------------------- */

export function getDefaultBackend(): BackendKey {
  const envDefault = String(env("VITE_BACKEND", env("REACT_APP_BACKEND", DEFAULT_BACKEND))).toLowerCase();
  return isValidBackendKey(envDefault) ? envDefault : (DEFAULT_BACKEND as BackendKey);
}

/* -------------------- chosen backend -------------------- */

export function getChosenBackend(): BackendKey {
  const saved = safeGetItem(BACKEND_KEY);
  if (isValidBackendKey(saved)) return String(saved).toLowerCase() as BackendKey;
  return getDefaultBackend();
}

export function ensureBackend(value: unknown): BackendKey {
  const v = String(value ?? "").toLowerCase();
  return isValidBackendKey(v) ? (v as BackendKey) : getChosenBackend();
}

export function setChosenBackend(value: unknown, opts: { reload?: boolean } = {}): void {
  const { reload = true } = opts;

  const v = String(value ?? "").toLowerCase();
  if (!isValidBackendKey(v)) return;

  safeSetItem(BACKEND_KEY, v);

  if (reload && typeof window !== "undefined") {
    window.location.reload();
  }
}

export function setChosenBackendNoReload(value: unknown): void {
  setChosenBackend(value, { reload: false });
}

/* -------------------- endpoints -------------------- */

export type BuiltEndpoints = {
  base: string;
  convos: string | null;
  rooms: string | null;
  users: string | null;
  friend: string | null;
  me: string | null;
  makeContact: string | null;
  firstMessage: string | null;
  roomMessages: ((roomId: string | number) => string) | null;
  kind: string;
  label: string;
  ws: WsConfig;
};

export function buildEndpoints(kind?: unknown): BuiltEndpoints {
  const k = isValidBackendKey(kind) ? (String(kind).toLowerCase() as BackendKey) : getChosenBackend();
  const cfg = BACKEND_REGISTRY[k];

  const base = pickEnvBase(cfg.apiBaseEnvKeys, cfg.defaultApiBase);
  const p = cfg.paths;

  return {
    base,
    convos: p.convos ? joinPath(base, p.convos) : null,
    rooms: p.rooms ? joinPath(base, p.rooms) : null,
    users: p.users ? joinPath(base, p.users) : null,
    friend: p.friend ? joinPath(base, p.friend) : null,
    me: p.me ? joinPath(base, p.me) : null,
    makeContact: p.makeContact ? joinPath(base, p.makeContact) : null,
    firstMessage: p.firstMessage ? joinPath(base, p.firstMessage) : null,
    roomMessages: typeof p.roomMessages === "function" ? (roomId) => joinPath(base, p.roomMessages(roomId)) : null,
    kind: cfg.key,
    label: cfg.label,
    ws: cfg.ws,
  };
}

/* -------------------- socket.io config -------------------- */

export type SocketIoConfig = { url: string; path: string };

export function buildSocketIoConfig(kind?: unknown): SocketIoConfig | null {
  const k = isValidBackendKey(kind) ? (String(kind).toLowerCase() as BackendKey) : getChosenBackend();
  const ws = BACKEND_REGISTRY[k]?.ws;

  if (!ws || ws.kind !== "socketio") return null;

  const url = normalizeBase(env(ws.urlEnvKey, ws.defaultWsUrl), ws.defaultWsUrl);
  const pathRaw = env(ws.pathEnvKey, ws.defaultWsPath) || ws.defaultWsPath;
  const path = String(pathRaw).trim() || ws.defaultWsPath;

  return { url, path };
}

/* -------------------- raw WS URL -------------------- */

export function buildWsUrl(kind: unknown, token: unknown): string | null {
  const k = isValidBackendKey(kind) ? (String(kind).toLowerCase() as BackendKey) : getChosenBackend();
  const ws = BACKEND_REGISTRY[k]?.ws;
  if (!ws) return null;

  if (ws.kind === "raw") {
    const raw = env(ws.wsEnvKey, ws.defaultWsBase);
    const base = normalizeBase(raw, ws.defaultWsBase);
    const sep = String(base).includes("?") ? "&" : "?";
    const param = encodeURIComponent(ws.tokenParam || "token");
    const t = encodeURIComponent(String(token || ""));
    return `${base}${sep}${param}=${t}`;
  }

  return null;
}

/* -------------------- hook -------------------- */

export function useBackendChoice(opts: { persist?: boolean } = {}) {
  const { persist = true } = opts;

  const [backendChoice, setBackendChoiceState] = useState<BackendKey>(() => getChosenBackend());

  const handleChangeBackend = useCallback(
    (eOrValue: unknown) => {
      const raw =
        typeof eOrValue === "string"
          ? eOrValue
          : (eOrValue as any)?.target?.value;

      if (!raw) return;

      const v = String(raw).toLowerCase();
      if (!isValidBackendKey(v)) return;

      setBackendChoiceState(v as BackendKey);
      if (persist) setChosenBackend(v, { reload: false });
    },
    [persist]
  );

  const effectiveKind: BackendKey = isValidBackendKey(backendChoice) ? backendChoice : getChosenBackend();

  const backendLabel = useMemo(
    () => BACKEND_REGISTRY[effectiveKind]?.label || effectiveKind,
    [effectiveKind]
  );

  const backendOptions = useMemo(
    () => BACKENDS.map((k) => ({ value: k, label: BACKEND_REGISTRY[k].label })),
    []
  );

  return {
    backendChoice: effectiveKind,
    effectiveKind,
    backendLabel,
    backendOptions,
    handleChangeBackend,
    setBackend: (k: BackendKey | string) => handleChangeBackend(k),
  } as const;
}