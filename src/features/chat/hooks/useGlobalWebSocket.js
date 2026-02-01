// src/hooks/useGlobalWebSocket.js
import { useEffect, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { wsConnected, wsDisconnected, wsError } from '@/app/store/wsActions';

const LOG = false;
const PRESENCE_NAME = 'presence.global';

export default function useGlobalWebSocket({
  backendKind,
  token,
  debugLabel = 'GlobalWS',
  currentUserId,
  onOnlineUsersChange,
  enableGlobalNotifications = false,
  handleGlobalNotification,
} = {}) {
  const dispatch = useDispatch();

  const onOnlineRef = useRef(onOnlineUsersChange);
  useEffect(() => {
    onOnlineRef.current = onOnlineUsersChange;
  }, [onOnlineUsersChange]);

  const onNotifRef = useRef(handleGlobalNotification);
  useEffect(() => {
    onNotifRef.current = handleGlobalNotification;
  }, [handleGlobalNotification]);

  const isReverb = String(backendKind || '').toLowerCase() === 'reverb';
  const shouldPresence = typeof onOnlineUsersChange === 'function';
  const shouldNotifications =
    Boolean(enableGlobalNotifications) &&
    typeof handleGlobalNotification === 'function' &&
    Number(currentUserId) > 0;

  const userPrivateChannel = useMemo(() => {
    return shouldNotifications ? `user.${Number(currentUserId)}` : null;
  }, [shouldNotifications, currentUserId]);

  // ✅ فقط از echo موجود استفاده می‌کنیم
  useEffect(() => {
    if (!isReverb) return;

    const echo = window.__echo;
    if (!echo) {
      // هنوز getOrCreateEcho ساخته نشده
      if (LOG) console.log('[GlobalWS] no window.__echo yet');
      return;
    }

    const conn = echo?.connector?.pusher?.connection;
    if (!conn) return;

    const onConn = () => dispatch(wsConnected());
    const onDis = () => dispatch(wsDisconnected());
    const onErr = (e) => dispatch(wsError(e?.message || e?.data || 'WS error'));

    conn.bind('connected', onConn);
    conn.bind('disconnected', onDis);
    conn.bind('error', onErr);

    return () => {
      try {
        conn.unbind('connected', onConn);
        conn.unbind('disconnected', onDis);
        conn.unbind('error', onErr);
      } catch {}
    };
  }, [dispatch, isReverb]);

  // -------- presence join ----------
  useEffect(() => {
    if (!isReverb || !shouldPresence) return;

    const echo = window.__echo;
    if (!echo) return;

    let ch;
    try {
      ch = echo.join(PRESENCE_NAME);

      ch.here((users) => onOnlineRef.current?.(Array.isArray(users) ? users : []));

      ch.joining((user) => {
        onOnlineRef.current?.((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          if (!user?.id) return arr;
          if (arr.some((u) => Number(u.id) === Number(user.id))) return arr;
          return [...arr, user];
        });
      });

      ch.leaving((user) => {
        onOnlineRef.current?.((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          if (!user?.id) return arr;
          return arr.filter((u) => Number(u.id) !== Number(user.id));
        });
      });
    } catch (e) {
      dispatch(wsError(e?.message || 'Presence join failed'));
    }

    return () => {
      try {
        echo.leave(PRESENCE_NAME);
      } catch {}
    };
  }, [dispatch, isReverb, shouldPresence]);

  // -------- user notifications ----------
  useEffect(() => {
    if (!isReverb || !userPrivateChannel) return;

    const echo = window.__echo;
    if (!echo) return;

    let ch;
    try {
      ch = echo.private(userPrivateChannel);
      ch.listen('.NotificationCreated', (packet) => {
        try {
          onNotifRef.current?.(packet);
        } catch {}
      });
    } catch (e) {
      dispatch(wsError(e?.message || 'User notifications subscribe failed'));
    }

    return () => {
      try {
        echo.leave(userPrivateChannel);
      } catch {}
    };
  }, [dispatch, isReverb, userPrivateChannel]);

  return { echo: typeof window !== 'undefined' ? window.__echo : null };
}

