import { useEffect, useMemo, useRef, useState } from 'react';
import { getOrCreateEcho } from '@/shared/config/realtime.js';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';
const log = (...a) => DEBUG && console.log('[usePresence]', ...a);

const PRESENCE_NAME_REVERB = 'global';
const PRESENCE_NAME_NODE = 'presence.global';

const toIdStr = (u) => {
  const id = u?.id ?? u?.user_id ?? u?.user?.id ?? u;
  return id == null ? null : String(id);
};

function buildWsUrlFromApiBase(apiBase, token) {
  const base = String(apiBase || '').replace(/\/+$/, '');
  const httpBase = base.endsWith('/api') ? base.slice(0, -4) : base;
  const wsBase = httpBase.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
  return `${wsBase}/ws?token=${encodeURIComponent(token || '')}`;
}

export function usePresence({ backendKind, token, currentUserId } = {}) {
  const backend = String(backendKind || '').toLowerCase();
  const isReverb = backend === 'reverb';
  const isNode = backend === 'node';

  const hasToken = Boolean(token);
  const hasUser = Number(currentUserId) > 0;

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connState, setConnState] = useState('unknown');

  // ---------- Reverb key ----------
  const key = useMemo(() => {
    if (!isReverb || !hasToken || !hasUser) return null;
    const tk = String(token).slice(0, 18);
    return `reverb|presence|${currentUserId}|${tk}`;
  }, [isReverb, hasToken, hasUser, currentUserId, token]);

  // ---------- Node key ----------
  const nodeKey = useMemo(() => {
    if (!isNode || !hasToken || !hasUser) return null;
    const tk = String(token).slice(0, 18);
    return `node|presence|${currentUserId}|${tk}`;
  }, [isNode, hasToken, hasUser, currentUserId, token]);

  // ===================== Reverb (همون قبلی) =====================
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

  useEffect(() => {
    if (!key) return;

    const echo = getOrCreateEcho(token);
    if (!echo) return;

    let ch;
    try {
      ch = echo.join(PRESENCE_NAME_REVERB);

      ch.here((users) => {
        const arr = Array.isArray(users) ? users : [];
        setOnlineUsers(arr);
        log('here ✅', { count: arr.length });
      });

      ch.joining((user) => {
        const id = toIdStr(user);
        if (!id) return;
        setOnlineUsers((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          if (arr.some((x) => toIdStr(x) === id)) return arr;
          return [...arr, user];
        });
      });

      ch.leaving((user) => {
        const id = toIdStr(user);
        if (!id) return;
        setOnlineUsers((prev) => (Array.isArray(prev) ? prev.filter((x) => toIdStr(x) !== id) : []));
      });

      setConnState('connected');
      log('presence joined ✅', { name: PRESENCE_NAME_REVERB });
    } catch (e) {
      log('presence join failed', e);
      setConnState('error');
    }

    return () => {
      try { echo.leave(PRESENCE_NAME_REVERB); } catch {}
      setOnlineUsers([]);
      setConnState('idle');
    };
  }, [key, token]);

  // ===================== Node WS Presence =====================
  useEffect(() => {
    if (!nodeKey) return;

    const API = String(import.meta.env.VITE_API_URL_NODE || '').replace(/\/+$/, '');
    if (!API) {
      setConnState('error-missing-api');
      return;
    }

    setOnlineUsers([]);
    setConnState('connecting');

    const wsUrl = buildWsUrlFromApiBase(API, token);
    log('[node] presence connecting', { wsUrl });

    const ws = new WebSocket(wsUrl);

    const sendJson = (obj) => {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
      } catch {}
    };

    ws.onopen = () => {
      setConnState('subscribing');
      sendJson({ type: 'subscribe', roomId: PRESENCE_NAME_NODE });
      log('[node] presence subscribe ->', PRESENCE_NAME_NODE);
    };

    ws.onmessage = (ev) => {
      let data;
      try { data = JSON.parse(String(ev?.data ?? '')); } catch { return; }

      // subscribed ack
      if (data?.type === 'subscribed' && String(data?.roomId) === PRESENCE_NAME_NODE) {
        setConnState('connected');
        return;
      }

      if (data?.type === 'presence_here' && String(data?.room) === PRESENCE_NAME_NODE) {
        const users = Array.isArray(data?.users) ? data.users : [];
        setOnlineUsers(users);
        log('[node] presence_here', { count: users.length });
        return;
      }

      if (data?.type === 'presence_join' && String(data?.room) === PRESENCE_NAME_NODE) {
        const u = data?.user;
        const id = toIdStr(u);
        if (!id) return;
        setOnlineUsers((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          if (arr.some((x) => toIdStr(x) === id)) return arr;
          return [...arr, u];
        });
        return;
      }

      if (data?.type === 'presence_leave' && String(data?.room) === PRESENCE_NAME_NODE) {
        const u = data?.user;
        const id = toIdStr(u);
        if (!id) return;
        setOnlineUsers((prev) => (Array.isArray(prev) ? prev.filter((x) => toIdStr(x) !== id) : []));
        return;
      }
    };

    ws.onerror = () => setConnState('error');
    ws.onclose = () => setConnState('idle');

    return () => {
      try { ws.close(); } catch {}
      setConnState('idle');
      setOnlineUsers([]);
    };
  }, [nodeKey, token]);

  return { onlineUsers, connState };
}
