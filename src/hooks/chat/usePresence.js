// src/hooks/chat/usePresence.js
import { useEffect, useMemo, useRef, useState } from 'react';
import useGlobalWebSocket from '@/hooks/useGlobalWebSocket';

const PRESENCE_NAME = 'presence.global';

// ✅ فقط وقتی خودت خواستی لاگ بده (مثلاً VITE_CHAT_DEBUG=true)
const DEBUG = import.meta.env.DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';
const dlog = (...a) => DEBUG && console.log('[usePresence]', ...a);
const dwarn = (...a) => DEBUG && console.warn('[usePresence]', ...a);

export function usePresence({ backendKind, token, currentUserId, onGlobalNotification }) {
  const [onlineUsers, setOnlineUsers] = useState([]);

  // ✅ فقط notification ها
  useGlobalWebSocket({
    backendKind,
    token,
    currentUserId,
    enableGlobalNotifications: true,
    handleGlobalNotification: onGlobalNotification,
  });

  const isReverb = useMemo(
    () => String(backendKind || '').toLowerCase() === 'reverb',
    [backendKind],
  );

  const joinedRef = useRef(false);
  const lastCountRef = useRef(-1);

  const joinPresence = () => {
    if (joinedRef.current) return;

    const echo = window.__echo;
    if (!echo) return dwarn('no window.__echo');

    try {
      const ch = echo.join(PRESENCE_NAME);

      ch.error?.((e) => dwarn('presence error', e));

      ch.here((users) => {
        const arr = Array.isArray(users) ? users : [];
        setOnlineUsers(arr);
        joinedRef.current = true;
        dlog('here', { count: arr.length });
      });

      ch.joining((user) => {
        setOnlineUsers((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          if (!user?.id) return arr;
          if (arr.some((u) => Number(u.id) === Number(user.id))) return arr;
          return [...arr, user];
        });
      });

      ch.leaving((user) => {
        setOnlineUsers((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          if (!user?.id) return arr;
          return arr.filter((u) => Number(u.id) !== Number(user.id));
        });
      });
    } catch (e) {
      joinedRef.current = false;
      dwarn('join failed', e);
    }
  };

  useEffect(() => {
    if (!isReverb) {
      joinedRef.current = false;
      setOnlineUsers([]);
      return;
    }

    const echo = window.__echo;
    if (!echo) return;

    const conn = echo?.connector?.pusher?.connection;
    if (!conn) return;

    const onConnected = () => {
      dlog('connected → join presence');
      joinPresence();
    };

    // اگر همین الان وصل است
    if (conn.state === 'connected') joinPresence();
    conn.bind('connected', onConnected);

    return () => {
      try {
        conn.unbind('connected', onConnected);
      } catch {}
      try {
        echo.leave(PRESENCE_NAME);
      } catch {}
      joinedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReverb, currentUserId]);

  // ✅ فقط وقتی count عوض شد لاگ کن
  useEffect(() => {
    if (!DEBUG) return;
    const c = onlineUsers?.length || 0;
    if (c !== lastCountRef.current) {
      lastCountRef.current = c;
      dlog('onlineCount', c);
    }
  }, [onlineUsers]);

  return { onlineUsers };
}
