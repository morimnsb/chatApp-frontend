// src/hooks/chat/usePresence.js
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import useGlobalWebSocket from '@/features/chat/hooks/useGlobalWebSocket.js';
import { getOrCreateEcho, getEchoUnsafe } from '@/shared/config/realtime.js';

const PRESENCE_NAME = 'presence.global';

const DEBUG = import.meta.env.DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';
const mkLoggers = (id) => {
  const p = `[usePresence#${id}]`;
  return {
    log: (...a) => console.log(p, ...a),
    dlog: (...a) => DEBUG && console.log(`${p}[DBG]`, ...a),
    dwarn: (...a) => DEBUG && console.warn(`${p}[WRN]`, ...a),
  };
};

function safePreview(x, n = 220) {
  try {
    const s = JSON.stringify(x);
    return s.length > n ? s.slice(0, n) + '…' : s;
  } catch {
    return String(x);
  }
}

export function usePresence({ backendKind, token, currentUserId, onGlobalNotification }) {
  const [onlineUsers, setOnlineUsers] = useState([]);

  // ✅ instance id برای تشخیص mount دوباره / چند instance
  const instanceIdRef = useRef(Math.random().toString(16).slice(2));
  const { log, dlog, dwarn } = useRef(mkLoggers(instanceIdRef.current)).current;

  const isReverb = useMemo(
    () => String(backendKind || '').toLowerCase() === 'reverb',
    [backendKind],
  );

  // 👇 برای اینکه cleanup لاگ stale نباشه
  const onlineCountRef = useRef(0);
  useEffect(() => {
    onlineCountRef.current = onlineUsers?.length || 0;
  }, [onlineUsers]);

  dlog('render', {
    backendKind,
    isDev: import.meta.env.DEV === true,
    hasToken: Boolean(token),
    currentUserId,
    onlineCount: onlineUsers?.length || 0,
  });

  useGlobalWebSocket({
    backendKind,
    token,
    currentUserId,
    enableGlobalNotifications: true,
    handleGlobalNotification: onGlobalNotification,
  });

  const joinedRef = useRef(false);
  const chRef = useRef(null);
  const joinAttemptsRef = useRef(0);

  const leavePresence = useCallback((echo, reason = 'cleanup') => {
    try {
      if (joinedRef.current) {
        dlog('echo.leave()', { presence: PRESENCE_NAME, reason });
        echo.leave(PRESENCE_NAME);
      } else {
        dlog('skip leave (not joined)', { reason });
      }
    } catch (e) {
      dwarn('echo.leave failed', e);
    } finally {
      joinedRef.current = false;
      chRef.current = null;
      setOnlineUsers([]);
    }
  }, [dlog, dwarn]);

  const joinPresence = useCallback((echo, reason = 'unknown') => {
    if (joinedRef.current) {
      dlog('joinPresence skipped (already joined) ✅', { reason });
      return;
    }

    const conn = echo?.connector?.pusher?.connection;
    dlog('joinPresence called', {
      reason,
      connState: conn?.state,
      socketId: conn?.socket_id,
      joinAttempts: joinAttemptsRef.current,
    });

    try {
      joinAttemptsRef.current += 1;

      const ch = echo.join(PRESENCE_NAME);
      chRef.current = ch;
      joinedRef.current = true; // ✅ فقط بعد از join موفق

      dlog('echo.join() OK ✅', { presence: PRESENCE_NAME });

      ch.error?.((e) => dwarn('presence error', e));

      ch.here((users) => {
        const arr = Array.isArray(users) ? users : [];
        setOnlineUsers(arr);
        dlog('here', { count: arr.length, usersPreview: safePreview(arr) });
      });

      ch.joining((user) => {
        dlog('joining', { userPreview: safePreview(user) });
        setOnlineUsers((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          if (!user?.id) return arr;
          if (arr.some((u) => Number(u.id) === Number(user.id))) return arr;
          return [...arr, user];
        });
      });

      ch.leaving((user) => {
        dlog('leaving', { userPreview: safePreview(user) });
        setOnlineUsers((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          if (!user?.id) return arr;
          return arr.filter((u) => Number(u.id) !== Number(user.id));
        });
      });
    } catch (e) {
      joinedRef.current = false;
      chRef.current = null;
      dwarn('join failed', e);
    }
  }, [dlog, dwarn]);

  useEffect(() => {
    log('effect mount', { isReverb, currentUserId });

    // reset وقتی backend عوض میشه
    if (!isReverb) {
      dlog('not reverb -> reset');
      joinedRef.current = false;
      chRef.current = null;
      setOnlineUsers([]);
      return () => log('effect cleanup (not reverb)');
    }

    // بدون توکن یا یوزر، حضور معنی نداره
    if (!token || !currentUserId) {
      dlog('missing token/user -> reset', { hasToken: Boolean(token), currentUserId });
      joinedRef.current = false;
      chRef.current = null;
      setOnlineUsers([]);
      return () => log('effect cleanup (missing token/user)');
    }

    // ✅ Echo singleton: اگر قبلاً ساخته شده استفاده کن، اگر نه بساز
    const echo = getEchoUnsafe() || getOrCreateEcho(token);

    if (!echo) {
      dwarn('no echo (getOrCreateEcho returned null) — check env');
      return () => log('effect cleanup (no echo)');
    }

    const conn = echo?.connector?.pusher?.connection;
    if (!conn) {
      dwarn('no conn in effect');
      return () => log('effect cleanup (no conn)');
    }

    const onConnected = () => {
      dlog('conn connected → joinPresence');
      joinPresence(echo, 'conn.connected');
    };

    // اگر همین الان وصل است
    if (conn.state === 'connected') {
      joinPresence(echo, 'conn.state===connected');
    }

    dlog('binding conn.connected listener');
    conn.bind('connected', onConnected);

    return () => {
      log('effect cleanup', {
        joined: joinedRef.current,
        onlineCount: onlineCountRef.current,
        connState: conn?.state,
        socketId: conn?.socket_id,
      });

      try {
        conn.unbind('connected', onConnected);
        dlog('unbind connected OK');
      } catch (e) {
        dwarn('unbind connected failed', e);
      }

      leavePresence(echo, 'effect.cleanup');
    };
    // ✅ token لازم است چون Echo ممکن است با آن ساخته شود
  }, [isReverb, token, currentUserId, joinPresence, leavePresence, log, dlog, dwarn]);

  // ✅ لاگ تغییر count
  const lastCountRef = useRef(-1);
  useEffect(() => {
    if (!DEBUG) return;
    const c = onlineUsers?.length || 0;
    if (c !== lastCountRef.current) {
      lastCountRef.current = c;
      dlog('onlineCount changed', { count: c });
    }
  }, [onlineUsers, dlog]);

  return { onlineUsers };
}



