// src/backend/choice.js
import { useCallback, useMemo, useState } from 'react';

export const BACKEND_KEY = 'backendChoice';

// ✅ چون الان پروژه‌ات روی node هست:
export const DEFAULT_BACKEND = 'node';

export const BACKEND_REGISTRY = {
  reverb: {
    key: 'reverb',
    label: 'Laravel + Reverb (real-time)',
    apiBaseEnvKeys: ['VITE_API_BASE_REVERB', 'REACT_APP_API_BASE_REVERB'],
    defaultApiBase: 'http://localhost:8000/api',
    paths: {
      convos: '/chat/conversations/',
      rooms: '/chat/chatrooms/',
      users: '/auth/users/',
      friend: '/chat/friendship',
      me: '/auth/me',
      makeContact: '/chat/make-contact',
      firstMessage: '/chat/make-contact',
      roomMessages: (roomId) => `/chat/messages/${roomId}/`,
    },
    ws: { kind: 'echo' },
  },

  node: {
    key: 'node',
    label: 'Node.js (Express)',
    apiBaseEnvKeys: ['VITE_API_BASE_NODE', 'REACT_APP_API_BASE_NODE'],
    // ✅ درست: 3000
    defaultApiBase: 'http://localhost:3000/api',
    paths: {
      // ✅ single source of truth
      convos: '/chat/conversations/',

      // ✅ IMPORTANT: alias "rooms" -> "convos"
      // so any legacy code calling endpoints.rooms will still hit conversations
      rooms: '/chat/conversations/',

      users: '/auth/users/',
      friend: '/chat/friendship/',
      me: '/auth/me',
      makeContact: '/chat/make-contact/',
      firstMessage: '/chat/make-contact/',
      roomMessages: (roomId) => `/chat/messages/${roomId}/`,
    },
    ws: {
      kind: 'socketio',
      // ✅ مطابق env تو:
      urlEnvKey: 'VITE_NODE_WS_URL',   // http://localhost:3000
      pathEnvKey: 'VITE_NODE_WS_PATH', // /socket.io
      defaultWsUrl: 'http://localhost:3000',
      defaultWsPath: '/socket.io',
    },
  },

  nest: {
    key: 'nest',
    label: 'NestJS',
    apiBaseEnvKeys: ['VITE_API_BASE_NEST', 'REACT_APP_API_BASE_NEST'],
    defaultApiBase: 'http://localhost:9100/api',
    paths: {
      convos: '/chat/conversations/',
      rooms: '/chat/rooms/',
      users: '/auth/users/',
      friend: '/chat/friendship/',
      me: '/auth/me',
      makeContact: '/chat/make-contact/',
      firstMessage: '/chat/make-contact/',
      roomMessages: (roomId) => `/chat/messages/${roomId}/`,
    },
    ws: {
      kind: 'socketio',
      urlEnvKey: 'VITE_NEST_WS_URL',
      pathEnvKey: 'VITE_NEST_WS_PATH',
      defaultWsUrl: 'http://localhost:9100',
      defaultWsPath: '/socket.io',
    },
  },

  django: {
    key: 'django',
    label: 'Django',
    apiBaseEnvKeys: ['VITE_API_BASE_DJANGO', 'REACT_APP_API_BASE_DJANGO'],
    defaultApiBase: 'http://localhost:8001/api',
    paths: {
      convos: '/chat/conversations/',
      rooms: '/chat/rooms/',
      users: '/auth/users/',
      friend: '/chat/friendship/',
      me: '/auth/me',
      makeContact: null,
      firstMessage: null,
      roomMessages: (roomId) => `/chat/messages/${roomId}/`,
    },
    ws: {
      kind: 'raw',
      wsEnvKey: 'VITE_WS_URL_DJANGO',
      defaultWsBase: 'ws://localhost:8001/ws/chat/',
      tokenParam: 'token',
    },
  },

  fastapi: {
    key: 'fastapi',
    label: 'FastAPI',
    apiBaseEnvKeys: ['VITE_API_BASE_FASTAPI', 'REACT_APP_API_BASE_FASTAPI'],
    defaultApiBase: 'http://localhost:8002/api',
    paths: {
      convos: '/chat/conversations/',
      rooms: '/chat/rooms/',
      users: '/auth/users/',
      friend: '/chat/friendship/',
      me: '/auth/me',
      makeContact: null,
      firstMessage: null,
      roomMessages: (roomId) => `/chat/messages/${roomId}/`,
    },
    ws: {
      kind: 'raw',
      wsEnvKey: 'VITE_WS_URL_FASTAPI',
      defaultWsBase: 'ws://localhost:8002/ws/chat/',
      tokenParam: 'token',
    },
  },
};

export const BACKENDS = Object.keys(BACKEND_REGISTRY);

/* ---------- safe localStorage ---------- */
function safeGetItem(key) {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function safeSetItem(key, value) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage?.setItem(key, value);
  } catch {}
}

/* ---------- env reader ---------- */
function env(key, fallback = undefined) {
  return (import.meta.env && import.meta.env[key]) ?? fallback;
}

/* ---------- sanitize base URLs ---------- */
function normalizeBase(val, fallback) {
  const v = (val ?? '').toString().trim();
  if (!v || v === '/' || /^(false|null|undefined|0)$/i.test(v)) {
    return String(fallback).replace(/\/+$/, '');
  }
  return v.replace(/\/+$/, '');
}

/* ---------- join base + path ---------- */
function joinPath(base, path) {
  const b = String(base ?? '').replace(/\/+$/, '');
  const p = String(path ?? '').replace(/^\/+/, '');
  return b ? `${b}/${p}` : `/${p}`;
}

function isValidBackendKey(k) {
  return Boolean(k && BACKEND_REGISTRY[String(k).toLowerCase()]);
}

function pickEnvBase(keys, fallback) {
  for (const k of keys || []) {
    const v = env(k);
    if (v != null && String(v).trim() !== '') return normalizeBase(v, fallback);
  }
  return normalizeBase(undefined, fallback);
}

/* ---------- default backend ---------- */
export function getDefaultBackend() {
  const envDefault = String(env('VITE_BACKEND', env('REACT_APP_BACKEND', DEFAULT_BACKEND))).toLowerCase();
  return isValidBackendKey(envDefault) ? envDefault : DEFAULT_BACKEND;
}

/* ---------- backend choice ---------- */
export function getChosenBackend() {
  const saved = safeGetItem(BACKEND_KEY);
  if (isValidBackendKey(saved)) return String(saved).toLowerCase();
  return getDefaultBackend();
}

export function ensureBackend(value) {
  const v = String(value ?? '').toLowerCase();
  return isValidBackendKey(v) ? v : getChosenBackend();
}

export function setChosenBackend(value, { reload = true } = {}) {
  if (!value) return;
  const v = String(value).toLowerCase();
  if (!isValidBackendKey(v)) return;

  safeSetItem(BACKEND_KEY, v);

  if (reload && typeof window !== 'undefined') {
    window.location.reload();
  }
}

export function setChosenBackendNoReload(value) {
  setChosenBackend(value, { reload: false });
}

/* ---------- build endpoints (ABSOLUTE) ---------- */
export function buildEndpoints(kind) {
  const k = isValidBackendKey(kind) ? String(kind).toLowerCase() : getChosenBackend();
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
    roomMessages: typeof p.roomMessages === 'function' ? (roomId) => joinPath(base, p.roomMessages(roomId)) : null,
    kind: cfg.key,
    label: cfg.label,
    ws: cfg.ws,
  };
}

/* ---------- socket.io config builder (node/nest) ---------- */
export function buildSocketIoConfig(kind) {
  const k = isValidBackendKey(kind) ? String(kind).toLowerCase() : getChosenBackend();
  const ws = BACKEND_REGISTRY[k]?.ws;
  if (!ws || ws.kind !== 'socketio') return null;

  const url = normalizeBase(env(ws.urlEnvKey, ws.defaultWsUrl), ws.defaultWsUrl);
  const pathRaw = env(ws.pathEnvKey, ws.defaultWsPath) || ws.defaultWsPath;
  const path = String(pathRaw).trim() || ws.defaultWsPath;

  return { url, path };
}

/* ---------- raw WS URL (only for ws.kind=raw) ---------- */
export function buildWsUrl(kind, token) {
  const k = isValidBackendKey(kind) ? String(kind).toLowerCase() : getChosenBackend();
  const ws = BACKEND_REGISTRY[k]?.ws;
  if (!ws) return null;

  if (ws.kind === 'raw') {
    const raw = env(ws.wsEnvKey, ws.defaultWsBase);
    const base = normalizeBase(raw, ws.defaultWsBase);
    const sep = String(base).includes('?') ? '&' : '?';
    const param = encodeURIComponent(ws.tokenParam || 'token');
    const t = encodeURIComponent(token || '');
    return `${base}${sep}${param}=${t}`;
  }

  return null;
}

/* ---------- hook ---------- */
export function useBackendChoice({ persist = true } = {}) {
  const [backendChoice, setBackendChoiceState] = useState(getChosenBackend());

  const handleChangeBackend = useCallback(
    (eOrValue) => {
      const raw = typeof eOrValue === 'string' ? eOrValue : eOrValue?.target?.value;
      if (!raw) return;

      const v = String(raw).toLowerCase();
      if (!isValidBackendKey(v)) return;

      setBackendChoiceState(v);
      if (persist) setChosenBackend(v, { reload: false });
    },
    [persist],
  );

  const effectiveKind = isValidBackendKey(backendChoice) ? backendChoice : getChosenBackend();

  const backendLabel = useMemo(
    () => BACKEND_REGISTRY[effectiveKind]?.label || effectiveKind,
    [effectiveKind],
  );

  const backendOptions = useMemo(
    () => BACKENDS.map((k) => ({ value: k, label: BACKEND_REGISTRY[k].label })),
    [],
  );

  return {
    backendChoice: effectiveKind,
    effectiveKind,
    backendLabel,
    backendOptions,
    handleChangeBackend,
    setBackend: (k) => handleChangeBackend(k),
  };
}
