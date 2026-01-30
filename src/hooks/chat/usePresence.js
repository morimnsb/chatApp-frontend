// src/hooks/chat/usePresence.js
import { useEffect, useMemo, useRef, useState } from 'react';
import useGlobalWebSocket from '@/hooks/useGlobalWebSocket';

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

  const isReverb = useMemo(() => String(backendKind || '').toLowerCase() === 'reverb', [backendKind]);

  const joinedRef = useRef(false);
  const chRef = useRef(null);
  const joinAttemptsRef = useRef(0);

  const joinPresence = (reason = 'unknown') => {
    if (joinedRef.current) {
      dlog('joinPresence skipped (already joined) ✅', { reason });
      return;
    }

    const echo = window.__echo;
    if (!echo) return dwarn('no window.__echo');

    const conn = echo?.connector?.pusher?.connection;
    dlog('joinPresence called', {
      reason,
      connState: conn?.state,
      socketId: conn?.socket_id,
      joinAttempts: joinAttemptsRef.current,
    });

    try {
      joinAttemptsRef.current += 1;

      // ✅ همینجا true کن تا اگر connected دوباره آمد، دوباره join نزند
      joinedRef.current = true;

      const ch = echo.join(PRESENCE_NAME);
      chRef.current = ch;

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
  };

  useEffect(() => {
    log('effect mount', { isReverb, currentUserId });

    if (!isReverb) {
      dlog('not reverb -> reset');
      joinedRef.current = false;
      chRef.current = null;
      setOnlineUsers([]);
      return () => log('effect cleanup (not reverb)');
    }

    const echo = window.__echo;
    if (!echo) {
      dwarn('no echo in effect');
      return () => log('effect cleanup (no echo)');
    }

    const conn = echo?.connector?.pusher?.connection;
    if (!conn) {
      dwarn('no conn in effect');
      return () => log('effect cleanup (no conn)');
    }

    const onConnected = () => {
      dlog('conn connected → joinPresence');
      joinPresence('conn.connected');
    };

    // اگر همین الان وصل است
    if (conn.state === 'connected') joinPresence('conn.state===connected');

    dlog('binding conn.connected listener');
    conn.bind('connected', onConnected);

    return () => {
      log('effect cleanup', {
        joined: joinedRef.current,
        onlineCount: onlineUsers?.length || 0,
        connState: conn?.state,
        socketId: conn?.socket_id,
      });

      try {
        conn.unbind('connected', onConnected);
        dlog('unbind connected OK');
      } catch (e) {
        dwarn('unbind connected failed', e);
      }

      // ✅ فقط اگر قبلاً join کرده‌ایم leave کن
      try {
        if (joinedRef.current) {
          dlog('echo.leave()', { presence: PRESENCE_NAME });
          echo.leave(PRESENCE_NAME);
        } else {
          dlog('skip leave (not joined)');
        }
      } catch (e) {
        dwarn('echo.leave failed', e);
      }

      joinedRef.current = false;
      chRef.current = null;
      setOnlineUsers([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReverb, currentUserId]);

  // ✅ لاگ تغییر count (کمک می‌کند نوسان 1↔2 را بفهمیم)
  const lastCountRef = useRef(-1);
  useEffect(() => {
    if (!DEBUG) return;
    const c = onlineUsers?.length || 0;
    if (c !== lastCountRef.current) {
      lastCountRef.current = c;
      dlog('onlineCount changed', { count: c });
    }
  }, [onlineUsers]);

  return { onlineUsers };
}
