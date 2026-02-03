// src/features/chat/hooks/useGlobalWebSocket.js
import { useEffect, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { wsConnected, wsDisconnected, wsError } from '@/app/store/wsActions';

const LOG = false;

export default function useGlobalWebSocket({
  backendKind,
  token, // (اینجا فقط برای سازگاری امضا نگه داشته شده)
  debugLabel = 'GlobalWS',
  currentUserId,
  enableGlobalNotifications = false,
  handleGlobalNotification,
} = {}) {
  const dispatch = useDispatch();

  const onNotifRef = useRef(handleGlobalNotification);
  useEffect(() => {
    onNotifRef.current = handleGlobalNotification;
  }, [handleGlobalNotification]);

  const isReverb = String(backendKind || '').toLowerCase() === 'reverb';
  const shouldNotifications =
    Boolean(enableGlobalNotifications) &&
    typeof handleGlobalNotification === 'function' &&
    Number(currentUserId) > 0;

  const userPrivateChannel = useMemo(() => {
    return shouldNotifications ? `user.${Number(currentUserId)}` : null;
  }, [shouldNotifications, currentUserId]);

  // ✅ فقط اتصال WS را مانیتور کن
  useEffect(() => {
    if (!isReverb) return;

    const echo = window.__echo;
    if (!echo) {
      if (LOG) console.log(`[${debugLabel}] no window.__echo yet`);
      return;
    }

    const conn = echo?.connector?.pusher?.connection;
    if (!conn) return;

    const onConn = () => dispatch(wsConnected());
    const onDis = () => dispatch(wsDisconnected());
    const onErr = (e) => dispatch(wsError(e?.message || e?.data || 'WS error'));

    // Pusher reliable events
    conn.bind?.('connected', onConn);
    conn.bind?.('disconnected', onDis);
    conn.bind?.('error', onErr);

    return () => {
      try { conn.unbind?.('connected', onConn); } catch {}
      try { conn.unbind?.('disconnected', onDis); } catch {}
      try { conn.unbind?.('error', onErr); } catch {}
    };
  }, [dispatch, isReverb, debugLabel]);

  // ✅ فقط نوتیفیکیشن‌های private-user
  useEffect(() => {
    if (!isReverb || !userPrivateChannel) return;

    const echo = window.__echo;
    if (!echo) return;

    try {
      const ch = echo.private(userPrivateChannel);
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
