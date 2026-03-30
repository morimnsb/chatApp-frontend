//chatApp-frontend\src\shared\backend\index.ts
import { useEffect, useState, useCallback, useMemo } from "react";

export const BACKEND_KEY = "backendChoice" as const;

export const BACKENDS = ["reverb", "node", "django"] as const;
export type BackendKey = (typeof BACKENDS)[number];

export type WsKind = "reverb" | "socketio" | "none";

export type BackendPaths = {
  health: string;
  login: string;
  logout: string;
  me: string;

  convos: string;
  rooms: string;
  users: string;

  friend: string;
  friendRespond: string;

  roomMessages: (roomId: number | string) => string;
};

export type BackendConfig = {
  key: BackendKey;
  label: string;
  apiBaseEnvKeys: readonly string[];
  defaultApiBase: string;
  ws: { kind: WsKind };
  paths: BackendPaths;
};

const normalizeKey = (v: unknown): BackendKey | "" => {
  const k = String(v ?? "").trim().toLowerCase();
  return (BACKENDS as readonly string[]).includes(k) ? (k as BackendKey) : "";
};

export const BACKEND_REGISTRY: Record<BackendKey, BackendConfig> = {
  reverb: {
    key: "reverb",
    label: "Laravel + Reverb",
    apiBaseEnvKeys: ["VITE_API_BASE_REVERB", "VITE_API_URL"],
    defaultApiBase: "http://127.0.0.1:8000/api",
    ws: { kind: "reverb" },
    paths: {
      health: "/health",
      login: "/auth/login",
      logout: "/auth/logout",
      me: "/auth/me",

      convos: "/chat/conversations/",
      rooms: "/chat/chatrooms/",
      roomMessages: (roomId) => `/chat/messages/${roomId}/`,
      users: "/auth/users/",
      friend: "/chat/friendship",
      friendRespond: "/chat/friendship/respond",
    },
  },

  node: {
    key: "node",
    label: "Node.js + Socket.IO",
    apiBaseEnvKeys: ["VITE_API_BASE_NODE", "VITE_API_URL"],
    defaultApiBase: "http://127.0.0.1:3000/api",
    ws: { kind: "socketio" },
    paths: {
      health: "/health",
      login: "/auth/login",
      logout: "/auth/logout",
      me: "/auth/me",

      convos: "/chat/conversations",
      rooms: "/chat/rooms",
      roomMessages: (roomId) => `/chat/rooms/${roomId}/messages`,
      users: "/auth/users",
      friend: "/chat/friendship",
      friendRespond: "/chat/friendship/respond",
    },
  },

  django: {
  key: "django",
  label: "Django (REST + Socket.IO)",
  apiBaseEnvKeys: ["VITE_API_BASE_DJANGO", "VITE_API_URL"],
  defaultApiBase: "http://localhost:8000/api",
  ws: { kind: "socketio" },
  paths: {
    health: "/health",
    login: "/auth/login",
    logout: "/auth/logout",
    me: "/auth/me",

    convos: "/chat/conversations/",
    rooms: "/chat/conversations/",
    roomMessages: (roomId) => `/chat/messages/${roomId}/`,
    users: "/auth/users",

    friend: "/chat/friendship",
    friendRespond: "/chat/friendship/respond",
  },
},
};

// key chosen by user (localStorage)
export function getChosenBackendKey(): BackendKey | null {
  try {
    const savedRaw = localStorage.getItem(BACKEND_KEY);
    const saved = normalizeKey(savedRaw);
    return saved || null;
  } catch {
    return null;
  }
}

// backend object
export function getBackend(keyOverride?: BackendKey | string | null): BackendConfig {
  const key =
    normalizeKey(keyOverride) ||
    normalizeKey(getChosenBackendKey()) ||
    "reverb";

  return BACKEND_REGISTRY[key];
}

// API base from env or default
export function resolveApiBase(backend?: BackendKey | BackendConfig | null): string {
  const b: BackendConfig =
    typeof backend === "string" ? getBackend(backend) : backend || getBackend();

  const keys = Array.isArray(b.apiBaseEnvKeys) ? b.apiBaseEnvKeys : [];

  for (const k of keys) {
    const v = (import.meta.env as Record<string, unknown>)[k];
    if (v != null && String(v).trim()) {
      return String(v).replace(/\/$/, "");
    }
  }

  return String(b.defaultApiBase || "").replace(/\/$/, "");
}

// endpoints = paths
export function buildEndpoints(backend?: BackendKey | BackendConfig | null): BackendPaths {
  const b =
    backend
      ? typeof backend === "string"
        ? getBackend(backend)
        : backend
      : getBackend();

  const paths = b.paths;

  const pick = <K extends keyof BackendPaths>(key: K, fallback: BackendPaths[K]) =>
    (paths?.[key] ?? fallback) as BackendPaths[K];

  return {
    health: pick("health", "/health"),
    login: pick("login", "/auth/login"),
    logout: pick("logout", "/auth/logout"),
    me: pick("me", "/auth/me"),

    convos: pick("convos", "/chat/conversations"),
    rooms: pick("rooms", "/chat/rooms"),
    users: pick("users", "/auth/users"),

    friend: pick("friend", "/chat/friendship"),
    friendRespond: pick("friendRespond", "/chat/friendship/respond"),

    roomMessages:
      typeof paths?.roomMessages === "function"
        ? paths.roomMessages
        : (roomId) => `/chat/rooms/${roomId}/messages`,
  };
}

// backwards compatibility
export function getChosenBackend(): BackendConfig {
  return getBackend();
}

export function setChosenBackendNoReload(key: BackendKey | string | null | undefined): void {
  try {
    const normalized = normalizeKey(key);
    if (normalized) {
      localStorage.setItem(BACKEND_KEY, normalized);
    } else {
      localStorage.removeItem(BACKEND_KEY);
    }
  } catch {}
}

export function setChosenBackend(key: BackendKey | string | null | undefined): void {
  setChosenBackendNoReload(key);
}

export function useBackendChoice() {
  const [backendChoice, setBackendChoice] = useState<BackendKey | "">(() => {
    try {
      return normalizeKey(localStorage.getItem(BACKEND_KEY));
    } catch {
      return "";
    }
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === BACKEND_KEY) {
        setBackendChoice(normalizeKey(e.newValue));
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleChangeBackend = useCallback((nextKey: unknown) => {
    const nk = (normalizeKey(nextKey) || "reverb") as BackendKey;

    try {
      localStorage.setItem(BACKEND_KEY, nk);
    } catch {}

    setBackendChoice(nk);
  }, []);

  const effectiveKind = useMemo<BackendKey>(() => {
    return (
      normalizeKey(backendChoice) ||
      normalizeKey(getChosenBackendKey()) ||
      "reverb"
    ) as BackendKey;
  }, [backendChoice]);

  return {
    backendChoice,
    effectiveKind,
    handleChangeBackend,
  } as const;
}