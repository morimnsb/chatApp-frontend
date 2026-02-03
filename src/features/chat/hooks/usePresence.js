// src/features/chat/hooks/usePresence.js
import { useEffect, useMemo, useRef, useState } from 'react';
import { getOrCreateEcho } from '@/shared/config/realtime.js';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';
const log = (...a) => DEBUG && console.log('[usePresence]', ...a);

const PRESENCE_NAME = 'global';

const toIdStr = (u) => {
  const id = u?.id ?? u?.user_id ?? u?.user?.id ?? u;
  return id == null ? null : String(id);
};

export function usePresence({
  backendKind,
  token,
  currentUserId,
  onGlobalNotification, // optional: forwarded global notify
} = {}) {
  const isReverb = String(backendKind || '').toLowerCase() === 'reverb';
  const hasToken = Boolean(token);
  const hasUser = Number(currentUserId) > 0;

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connState, setConnState] = useState('unknown');

  const didJoinRef = useRef(false);
  const lastKeyRef = useRef(null);

  const key = useMemo(() => {
    if (!isReverb || !hasToken || !hasUser) return null;
    const tk = String(token).slice(0, 18);
    return `reverb|presence|${currentUserId}|${tk}`;
  }, [isReverb, hasToken, hasUser, currentUserId, token]);

  useEffect(() => {
    if (!key) return;

    // اگر key عوض شد، state ریست بشه
    if (lastKeyRef.current && lastKeyRef.current !== key) {
      setOnlineUsers([]);
      didJoinRef.current = false;
    }
    lastKeyRef.current = key;
  }, [key]);

  // --- connection state (debug) ---
  useEffect(() => {
    if (!key) return;

    const echo = getOrCreateEcho(token);
    if (!echo) return;

    const conn = echo?.connector?.pusher?.connection;
    if (!conn) return;

    const sync = () => setConnState(conn.state || 'unknown');
    sync();

    const onState = (st) => {
      setConnState(st?.current || conn.state || 'unknown');
      log('pusher state_change', st);
    };

    conn.bind?.('state_change', onState);
    conn.bind?.('connected', sync);
    conn.bind?.('disconnected', sync);

    return () => {
      try {
        conn.unbind?.('state_change', onState);
        conn.unbind?.('connected', sync);
        conn.unbind?.('disconnected', sync);
      } catch {}
    };
  }, [key, token]);

  // --- presence join (single join) ---
  useEffect(() => {
    if (!key) return;

    const echo = getOrCreateEcho(token);
    if (!echo) return;

    if (didJoinRef.current) return;
    didJoinRef.current = true;

    log('joining presence...', { name: PRESENCE_NAME, reason: 'initial.connected' });

    let ch;
    try {
      ch = echo.join(PRESENCE_NAME);

      // ✅ snapshot (initial list)
      ch.here((users) => {
        const arr = Array.isArray(users) ? users : [];
        setOnlineUsers(arr);
        log('here ✅', { count: arr.length });
      });

      // ✅ joining
      ch.joining((user) => {
        const id = toIdStr(user);
        if (!id) return;
        setOnlineUsers((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          if (arr.some((x) => toIdStr(x) === id)) return arr;
          return [...arr, user];
        });
      });

      // ✅ leaving
      ch.leaving((user) => {
        const id = toIdStr(user);
        if (!id) return;
        setOnlineUsers((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          return arr.filter((x) => toIdStr(x) !== id);
        });
      });

      log('presence joined ✅', { name: PRESENCE_NAME });
    } catch (e) {
      log('presence join failed', e);
      didJoinRef.current = false;
    }

    return () => {
      // مهم: leave فقط وقتی unmount واقعی شد
      try {
        echo.leave(PRESENCE_NAME);
      } catch {}
      didJoinRef.current = false;
      setOnlineUsers([]);
    };
  }, [key, token]);

  return { onlineUsers, connState };
}
