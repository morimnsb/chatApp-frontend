// src/shared/backend/index.js

import { useEffect, useState, useCallback, useMemo } from "react";
export const BACKEND_KEY = "backendChoice";

export const BACKEND_REGISTRY = {
  reverb: {
    key: "reverb",
    label: "Laravel + Reverb",
    apiBaseEnvKeys: ["VITE_API_BASE_REVERB", "VITE_API_URL"],
    defaultApiBase: "http://localhost:8000/api",
    ws: { kind: "reverb" },
    paths: {
      health: "/health",
      login: "/auth/login",
      logout: "/auth/logout",
      me: "/auth/me",

      // Laravel chat
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
    defaultApiBase: "http://localhost:3000/api",
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
    label: "Django (REST)",
    apiBaseEnvKeys: ["VITE_API_BASE_DJANGO", "VITE_API_URL"],
    defaultApiBase: "http://localhost:8001/api",
    ws: { kind: "none" },
    paths: {
      health: "/health/",
      login: "/auth/login/",
      logout: "/auth/logout/",
      me: "/auth/me/",

      convos: "/chat/conversations/",
      rooms: "/chat/rooms/",
      roomMessages: (roomId) => `/chat/rooms/${roomId}/messages/`,
      users: "/users/",
      friend: "/chat/friendship/",
      friendRespond: "/chat/friendship/respond/",
    },
  },
};

export const BACKENDS = ["reverb", "node", "django"];

// ✅ key chosen by user (localStorage)
export function getChosenBackendKey() {
  try {
    const savedRaw = localStorage.getItem(BACKEND_KEY);
    const saved = String(savedRaw || "").trim().toLowerCase();
    return saved && BACKEND_REGISTRY[saved] ? saved : null;
  } catch {
    return null;
  }
}


// ✅ backend object (fallback to node if nothing)
export function getBackend(keyOverride) {
  const key = keyOverride || getChosenBackendKey() || "reverb";
  return BACKEND_REGISTRY[key] || BACKEND_REGISTRY.reverb;
}


// ✅ API base from env or default
export function resolveApiBase(backend) {
  const b =
    typeof backend === "string"
      ? getBackend(backend)
      : backend || getBackend();

  const keys = Array.isArray(b.apiBaseEnvKeys) ? b.apiBaseEnvKeys : [];

  for (const k of keys) {
    const v = import.meta.env[k];
    if (v) return String(v).replace(/\/$/, "");
  }
  return String(b.defaultApiBase || import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
}

// ✅ endpoints = paths (normalized)
export function buildEndpoints(backend) {
  const b = backend || getBackend();
  const paths = b?.paths || {};

  const pick = (key, fallback) => paths?.[key] || fallback;

  return {
    health: pick("health", "/health"),
    login: pick("login", "/auth/login"),
    logout: pick("logout", "/auth/logout"),
    me: pick("me", "/auth/me"),

    convos: pick("convos", "/chat/conversations"),
    rooms: pick("rooms", "/chat/rooms"),
    users: pick("users", "/users"),

    friend: pick("friend", "/chat/friendship"),
    friendRespond: pick("friendRespond", "/chat/friendship/respond"),

    roomMessages:
      typeof paths.roomMessages === "function"
        ? paths.roomMessages
        : (roomId) => `/chat/rooms/${roomId}/messages`,
  };
}
// --- backwards compatibility ---
// بعضی فایل‌ها هنوز getChosenBackend رو import می‌کنن
export function getChosenBackend() {
  return getBackend(); // backend object
}
// --- backwards compatibility (old code imports) ---
export function setChosenBackendNoReload(key) {
  try {
    if (key) localStorage.setItem(BACKEND_KEY, String(key));
    else localStorage.removeItem(BACKEND_KEY);
  } catch {}
}

// اگر جایی setChosenBackend هم استفاده میشه:
export function setChosenBackend(key) {
  setChosenBackendNoReload(key);
}


const normalizeKey = (v) => {
  const k = String(v || "").trim().toLowerCase();
  return BACKENDS.includes(k) ? k : "";
};

export function useBackendChoice() {
  const [backendChoice, setBackendChoice] = useState(() => {
    try {
      return normalizeKey(localStorage.getItem(BACKEND_KEY));
    } catch {
      return "";
    }
  });

  // keep in sync if another tab changes it
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === BACKEND_KEY) setBackendChoice(normalizeKey(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleChangeBackend = useCallback((nextKey) => {
    const nk = normalizeKey(nextKey) || "reverb"; // ✅ default
    try {
      localStorage.setItem(BACKEND_KEY, nk);
    } catch {}
    setBackendChoice(nk);
  }, []);

  const effectiveKind = useMemo(() => {
    // ✅ always return a valid kind
    const k = normalizeKey(backendChoice);
    return k || normalizeKey(getChosenBackendKey()) || "reverb";
  }, [backendChoice]);

  return {
    backendChoice,        // for UI picker value
    effectiveKind,        // for logic (HomeChat / realtime)
    handleChangeBackend,  // function expected by LoginForm
  };
}
