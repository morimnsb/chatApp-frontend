// src/hooks/useGlobalWebSocket.js
import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { wsConnected, wsDisconnected, wsError } from '@/store/wsActions';

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

const LOG = false;
const PRESENCE_NAME = 'presence.global';

if (typeof window !== 'undefined') window.Pusher = Pusher;

// Singleton (shared across app)
let globalEcho = null;
let echoTokenSig = null;

const stripBearer = (t) => String(t || '').replace(/^Bearer\s+/i, '').trim();
const toBearer = (t) => {
  const bare = stripBearer(t);
  return bare ? `Bearer ${bare}` : '';
};

export default function useGlobalWebSocket({
  backendKind,
  token,
  debugLabel = 'GlobalWS',

  // ✅ current user (برای کانال خصوصی user)
  currentUserId,

  // Presence
  onOnlineUsersChange,

  // Notifications
  enableGlobalNotifications = false,
  handleGlobalNotification,
} = {}) {
  const dispatch = useDispatch();

  const [state, setState] = useState({
    backend: null,
    status: 'off', // off | connecting | connected | disconnected | error
    lastEvent: null,
  });

  // --- stable refs (prevent resubscribe due to new function references) ---
  const onOnlineRef = useRef(onOnlineUsersChange);
  useEffect(() => {
    onOnlineRef.current = onOnlineUsersChange;
  }, [onOnlineUsersChange]);

  const onNotifRef = useRef(handleGlobalNotification);
  useEffect(() => {
    onNotifRef.current = handleGlobalNotification;
  }, [handleGlobalNotification]);

  // guards
  const presenceJoinedRef = useRef(false);

  const notifSubscribedRef = useRef(false);
  const notifChannelNameRef = useRef(null);

  const shouldPresence = typeof onOnlineUsersChange === 'function';

  const shouldNotifications =
    Boolean(enableGlobalNotifications) &&
    typeof handleGlobalNotification === 'function' &&
    Number.isFinite(Number(currentUserId)) &&
    Number(currentUserId) > 0;

  // ✅ user-private channel (Echo private('user.2') => wire: private-user.2)
  const userPrivateChannel = shouldNotifications
    ? `user.${Number(currentUserId)}`
    : null;

  const disposeEcho = useCallback(() => {
    if (!globalEcho) return;

    try {
      if (presenceJoinedRef.current) globalEcho.leave(PRESENCE_NAME);
    } catch {}
    presenceJoinedRef.current = false;

    try {
      const prev = notifChannelNameRef.current;
      if (notifSubscribedRef.current && prev) globalEcho.leave(prev);
    } catch {}
    notifSubscribedRef.current = false;
    notifChannelNameRef.current = null;

    try {
      globalEcho.disconnect();
    } catch {}

    globalEcho = null;
    echoTokenSig = null;

    if (LOG) console.log('[GlobalWS] disposed', debugLabel);
  }, [debugLabel]);

  // -------- connect / recreate echo (ONLY when token changes) ----------
  useEffect(() => {
    const isReverb = String(backendKind || '').toLowerCase() === 'reverb';
    const bearer = toBearer(token);
    const hasToken = !!bearer;

    if (!isReverb || !hasToken) {
      disposeEcho();
      setState({ backend: null, status: 'off', lastEvent: null });
      dispatch(wsDisconnected());
      return;
    }

    const appKey = import.meta.env.VITE_REVERB_APP_KEY;
    const host = import.meta.env.VITE_REVERB_HOST || window.location.hostname;
    const port = Number(import.meta.env.VITE_REVERB_PORT || 8080);

    const apiBase =
      import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:8000';

    const authEndpoint = `${apiBase}/api/broadcasting/auth`;

    if (!appKey) {
      const msg = 'Missing VITE_REVERB_APP_KEY';
      dispatch(wsError(msg));
      setState({ backend: 'reverb', status: 'error', lastEvent: { message: msg } });
      return;
    }

    // ✅ recreate only if bearer changed
    const tokenSig = bearer;
    const needRecreate = !globalEcho || echoTokenSig !== tokenSig;

    if (needRecreate) {
      disposeEcho();

      try {
        globalEcho = new Echo({
          broadcaster: 'pusher',
          key: appKey,

          wsHost: host,
          wsPort: port,
          wssPort: port,

          forceTLS: false,
          enabledTransports: ['ws'],
          disabledTransports: ['xhr_polling', 'xhr_streaming'],
          cluster: 'mt1',

          authEndpoint,
          auth: {
            headers: {
              Authorization: tokenSig,
              Accept: 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
          },
        });

        window.__echo = globalEcho;
        echoTokenSig = tokenSig;

        if (LOG) {
          console.log('[GlobalWS] Echo created', {
            debugLabel,
            wsHost: host,
            wsPort: port,
            authEndpoint,
          });
        }
      } catch (e) {
        const msg = e?.message || 'Error creating Echo';
        dispatch(wsError(msg));
        setState({ backend: 'reverb', status: 'error', lastEvent: { message: msg } });
        return;
      }

      const conn = globalEcho?.connector?.pusher?.connection;
      if (conn) {
        conn.bind('connected', () => {
          if (LOG) console.log('[GlobalWS] connected', debugLabel);
          setState((s) => ({ ...s, backend: 'reverb', status: 'connected' }));
          dispatch(wsConnected());
        });

        conn.bind('disconnected', () => {
          if (LOG) console.log('[GlobalWS] disconnected', debugLabel);
          setState((s) => ({ ...s, backend: 'reverb', status: 'disconnected' }));
          dispatch(wsDisconnected());

          // اجازه بده دوباره join/subscription بعد از reconnect انجام شود
          presenceJoinedRef.current = false;
          notifSubscribedRef.current = false;
          notifChannelNameRef.current = null;
        });

        conn.bind('error', (err) => {
          if (LOG) console.log('[GlobalWS] error', err);
          setState((s) => ({ ...s, backend: 'reverb', status: 'error', lastEvent: err }));
          dispatch(wsError(err?.data || err?.message || 'WS error'));
        });

        conn.bind('failed', (err) => {
          if (LOG) console.log('[GlobalWS] failed', err);
          setState((s) => ({ ...s, backend: 'reverb', status: 'error', lastEvent: err }));
          dispatch(wsError(err?.data || err?.message || 'WS failed'));
        });
      }
    }

    setState((s) => ({
      ...s,
      backend: 'reverb',
      status: s.status === 'connected' ? 'connected' : 'connecting',
    }));
  }, [backendKind, token, dispatch, debugLabel, disposeEcho]);

  // -------- presence join ----------
  useEffect(() => {
    const isReverb = String(backendKind || '').toLowerCase() === 'reverb';
    const bearer = toBearer(token);

    if (!isReverb || !bearer) return;
    if (!shouldPresence) return;
    if (!globalEcho) return;
    if (state.status !== 'connected') return;
    if (presenceJoinedRef.current) return;

    try {
      const p = globalEcho.join(PRESENCE_NAME);

      p.here((users) => onOnlineRef.current?.(Array.isArray(users) ? users : []));

      p.joining((user) => {
        onOnlineRef.current?.((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          if (!user?.id) return arr;
          if (arr.some((u) => Number(u.id) === Number(user.id))) return arr;
          return [...arr, user];
        });
      });

      p.leaving((user) => {
        onOnlineRef.current?.((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          if (!user?.id) return arr;
          return arr.filter((u) => Number(u.id) !== Number(user.id));
        });
      });

      presenceJoinedRef.current = true;
      if (LOG) console.log('[GlobalWS] presence joined');
    } catch (e) {
      dispatch(wsError(e?.message || 'Presence join failed'));
    }

    return () => {
      try {
        globalEcho?.leave(PRESENCE_NAME);
      } catch {}
      presenceJoinedRef.current = false;
    };
  }, [backendKind, token, state.status, dispatch, shouldPresence]);

  // -------- ✅ user notifications (private-user.{id}) ----------
  useEffect(() => {
    const isReverb = String(backendKind || '').toLowerCase() === 'reverb';
    const bearer = toBearer(token);

    if (!isReverb || !bearer) return;
    if (!shouldNotifications) return;
    if (!globalEcho) return;
    if (state.status !== 'connected') return;
    if (!userPrivateChannel) return;

    // اگر قبلاً روی همین کانال subscribe شده، هیچ کاری نکن
    if (notifSubscribedRef.current && notifChannelNameRef.current === userPrivateChannel) {
      return;
    }

    // اگر کانال عوض شد، قبلی رو leave کن
    if (notifSubscribedRef.current && notifChannelNameRef.current) {
      try {
        globalEcho.leave(notifChannelNameRef.current);
      } catch {}
      notifSubscribedRef.current = false;
      notifChannelNameRef.current = null;
    }

    try {
      // ✅ private channel for this user
      const ch = globalEcho.private(userPrivateChannel);

      ch.listen('.NotificationCreated', (packet) => {
        try {
          onNotifRef.current?.(packet);
        } catch {}
      });

      notifSubscribedRef.current = true;
      notifChannelNameRef.current = userPrivateChannel;

      if (LOG) console.log('[GlobalWS] user notifications subscribed', userPrivateChannel);
    } catch (e) {
      dispatch(wsError(e?.message || 'User notifications subscribe failed'));
    }

    return () => {
      try {
        globalEcho?.leave(userPrivateChannel);
      } catch {}
      notifSubscribedRef.current = false;
      notifChannelNameRef.current = null;
    };
  }, [
    backendKind,
    token,
    state.status,
    dispatch,
    shouldNotifications,
    userPrivateChannel,
  ]);

  return {
    backend: state.backend,
    status: state.status,
    lastEvent: state.lastEvent,
    echo: globalEcho,
  };
}
