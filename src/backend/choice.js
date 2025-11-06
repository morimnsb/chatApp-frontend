// src/backend/choice.js
import { useCallback, useState } from 'react';

export const BACKENDS = ['laravel', 'django', 'reverb'];
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

/* ---------- CRA env reader ---------- */
function env(key, fallback = undefined) {
  return (
    (typeof process !== 'undefined' && process.env && process.env[key]) ??
    fallback
  );
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
  const envDefault = String(env('REACT_APP_BACKEND', 'laravel')).toLowerCase();
  return BACKENDS.includes(envDefault) ? envDefault : 'laravel';
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
  const k = String(kind || 'laravel').toLowerCase();

  // از .env شما:
  // REACT_APP_API_BASE_LARAVEL=http://localhost:8000/api
  // (برای Django/Reverb اگر جدا هستند می‌توانید مقدار جدا بدهید)
  const baseLaravel = normalizeBase(
    env('REACT_APP_API_BASE_LARAVEL'),
    'http://localhost:8000/api',
  );
  const baseDjango = normalizeBase(
    env('REACT_APP_API_BASE_DJANGO'),
    'http://localhost:8000',
  );
  const baseReverb = normalizeBase(
    env('REACT_APP_API_BASE_REVERB'),
    baseLaravel,
  );

  if (k === 'django') {
    return {
      base: baseDjango,
      convos: joinPath(baseDjango, '/chat/conversations/'),
      rooms: joinPath(baseDjango, '/chat/rooms/'),
      users: joinPath(baseDjango, '/auth/users/'),
      friend: joinPath(baseDjango, '/chat/friendship/'),
      me: joinPath(baseDjango, '/auth/me/'),
      firstMessage: null,
      kind: 'django',
    };
  }

  if (k === 'reverb') {
    return {
      base: baseReverb,
      convos: joinPath(baseReverb, '/chatMeetUp/conversations/'),
      rooms: joinPath(baseReverb, '/chatMeetUp/chatrooms/'),
      users: joinPath(baseReverb, '/auth/users/'),
      friend: joinPath(baseReverb, '/chatMeetUp/friendship'),
      me: joinPath(baseReverb, '/auth/me'),
      firstMessage: joinPath(baseReverb, '/chatMeetUp/first-message'),
      kind: 'reverb',
    };
  }

  // laravel (default)
  return {
    base: baseLaravel,
    convos: joinPath(baseLaravel, '/chatMeetUp/conversations/'),
    rooms: joinPath(baseLaravel, '/chatMeetUp/chatrooms/'),
    users: joinPath(baseLaravel, '/auth/users/'),
    friend: joinPath(baseLaravel, '/chatMeetUp/friendship'),
    me: joinPath(baseLaravel, '/auth/me'),
    firstMessage: joinPath(baseLaravel, '/chatMeetUp/first-message'),
    kind: 'laravel',
  };
}

/* ---------- raw WS URL (optional) ---------- */
export function buildWsUrl(kind, token) {
  const k = String(kind || 'laravel').toLowerCase();
  if (k === 'reverb') return null;
  // از .env شما:
  // REACT_APP_WS_URL=ws://localhost:8000/ws/chat/
  const raw = env('REACT_APP_WS_URL', 'ws://localhost:8000/ws/chat/');
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
    : 'laravel';
  return { backendChoice: effectiveKind, effectiveKind, handleChangeBackend };
}
