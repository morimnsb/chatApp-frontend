// src/backend/choice.js
import { useCallback, useState } from 'react';

/**
 * 🎯 از این به بعد فقط دو mode:
 * - 'reverb'  → Laravel + Reverb/Echo (real-time)
 * - 'django'  → Django backend
 */
export const BACKENDS = ['reverb', 'django'];
export const BACKEND_KEY = 'backendChoice';

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

/* ---------- join base + path ---------- */
function joinPath(base, path) {
  const b = String(base ?? '').replace(/\/+$/, '');
  const p = String(path ?? '').replace(/^\/+/, '');
  return b ? `${b}/${p}` : `/${p}`;
}

/* ---------- env reader (Vite) ---------- */
function env(key, fallback = undefined) {
  return (import.meta.env && import.meta.env[key]) ?? fallback;
}

/* ---------- sanitize base URLs ---------- */
function normalizeBase(val, fallback) {
  const v = (val ?? '').toString().trim();
  if (!v || v === '/' || /^(false|null|undefined|0)$/i.test(v)) return fallback;
  return v.replace(/\/+$/, ''); // no trailing slash
}

/* ---------- backend choice ---------- */
export function getChosenBackend() {
  const saved = safeGetItem(BACKEND_KEY);
  if (saved && BACKENDS.includes(saved)) return saved;

  // پیش‌فرض: reverb (Laravel + Reverb)
  const envDefault = String(env('REACT_APP_BACKEND', 'reverb')).toLowerCase();
  return BACKENDS.includes(envDefault) ? envDefault : 'reverb';
}

export function setChosenBackend(value) {
  if (!value) return;
  const v = String(value).toLowerCase();
  if (!BACKENDS.includes(v)) return;
  safeSetItem(BACKEND_KEY, v);
  if (typeof window !== 'undefined') window.location.reload();
}

/* ---------- build endpoints (ABSOLUTE) ---------- */
export function buildEndpoints(kind) {
  const k = String(kind || 'reverb').toLowerCase();

  // .env مثال:
  // REACT_APP_API_BASE_REVERB=http://localhost:8000/api
  // REACT_APP_API_BASE_DJANGO=http://localhost:8001
  const baseReverb = normalizeBase(
    env('REACT_APP_API_BASE_REVERB') || env('REACT_APP_API_BASE_LARAVEL'),
    'http://localhost:8000/api',
  );

  const baseDjango = normalizeBase(
    env('REACT_APP_API_BASE_DJANGO'),
    'http://localhost:8000',
  );

  // ---------- DJANGO ----------
  if (k === 'django') {
    return {
      base: baseDjango,
      convos: joinPath(baseDjango, '/chat/conversations/'),
      rooms: joinPath(baseDjango, '/chat/rooms/'),
      users: joinPath(baseDjango, '/auth/users/'),
      friend: joinPath(baseDjango, '/chat/friendship/'),
      me: joinPath(baseDjango, '/auth/me/'),

      makeContact: null,
      firstMessage: null,

      roomMessages: (roomId) =>
        joinPath(baseDjango, `/chat/messages/${roomId}/`),

      kind: 'django',
    };
  }

  // ---------- LARAVEL + REVERB (default) ----------
  return {
    base: baseReverb,
    convos: joinPath(baseReverb, '/chatMeetUp/conversations/'),
    rooms: joinPath(baseReverb, '/chatMeetUp/chatrooms/'),
    users: joinPath(baseReverb, '/auth/users/'),
    friend: joinPath(baseReverb, '/chatMeetUp/friendship'),
    me: joinPath(baseReverb, '/auth/me'),

    // برای باز کردن/ساختن DM
    makeContact: joinPath(baseReverb, '/chatMeetUp/make-contact'),
    firstMessage: joinPath(baseReverb, '/chatMeetUp/make-contact'),

    roomMessages: (roomId) =>
      joinPath(baseReverb, `/chatMeetUp/messages/${roomId}/`),

    kind: 'reverb',
  };
}

/* ---------- raw WS URL (فقط برای Django) ---------- */
export function buildWsUrl(kind, token) {
  const k = String(kind || 'reverb').toLowerCase();

  // برای Reverb از Echo connector استفاده می‌کنیم، نه buildWsUrl
  if (k === 'reverb') return null;

  // برای Django:
  const raw = env('REACT_APP_WS_URL_DJANGO', 'ws://localhost:8000/ws/chat/');
  const base = normalizeBase(raw, 'ws://localhost:8000/ws/chat');
  const sep = String(base).includes('?') ? '&' : '?';
  const t = encodeURIComponent(token || '');
  return `${base}${sep}token=${t}`;
}

/* ---------- hook ---------- */
export function useBackendChoice() {
  const [backendChoice, setBackendChoiceState] = useState(getChosenBackend());

  const handleChangeBackend = useCallback((eOrValue) => {
    const raw =
      typeof eOrValue === 'string' ? eOrValue : eOrValue?.target?.value;
    if (!raw) return;
    const v = String(raw).toLowerCase();
    setBackendChoiceState(v);
    setChosenBackend(v);
  }, []);

  const effectiveKind = BACKENDS.includes(backendChoice)
    ? backendChoice
    : 'reverb';

  return { backendChoice: effectiveKind, effectiveKind, handleChangeBackend };
}
