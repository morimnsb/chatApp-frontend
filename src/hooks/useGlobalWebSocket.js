// src/hooks/useGlobalWebSocket.js
import { useEffect, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { wsConnected, wsDisconnected, wsError } from '@/store/wsActions';

// ⚠️ حتما نصب شده باشن:
// npm i laravel-echo pusher-js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

const DEBUG_PREFIX = '[GlobalWS]';

// Pusher باید روی window ست بشه
if (typeof window !== 'undefined') {
  window.Pusher = Pusher;
}

// 👇 یک Echo سراسری برای کل اپ
let globalEcho = null;

export default function useGlobalWebSocket({
  backendKind,
  token,
  debugLabel = 'GlobalWS',
} = {}) {
  const dispatch = useDispatch();

  const [state, setState] = useState({
    backend: null, // 'reverb' | 'django' | null
    status: 'off', // 'off' | 'connecting' | 'connected' | 'error' | 'disconnected'
    lastEvent: null,
  });

  /* -------------------- اتصال/قطع Echo -------------------- */

  useEffect(() => {
    const isReverb = backendKind === 'reverb';
    const hasToken = !!token;

    console.log(DEBUG_PREFIX, 'effect start', {
      backendKind,
      hasToken,
      debugLabel,
    });

    // اگر بک‌اند Reverb نیست یا توکن نداریم → همه‌چیز رو خاموش کن
    if (!isReverb || !hasToken) {
      console.log(DEBUG_PREFIX, 'closing (not reverb or no token)', {
        backendKind,
        hasToken,
      });

      if (globalEcho) {
        try {
          globalEcho.disconnect();
        } catch (e) {
          console.error(DEBUG_PREFIX, 'error disconnecting globalEcho', e);
        }
        globalEcho = null;
      }

      setState((s) => ({
        ...s,
        backend: null,
        status: 'off',
      }));
      dispatch(wsDisconnected());
      return;
    }

    // ✅ اینجا باید Echo را بسازیم اگر هنوز ساخته نشده
    if (!globalEcho) {
      const appKey = import.meta.env.VITE_REVERB_APP_KEY;
      const host = import.meta.env.VITE_REVERB_HOST || window.location.hostname;
      const port = Number(import.meta.env.VITE_REVERB_PORT || 8080);
      const apiBase =
        import.meta.env.VITE_API_URL?.replace(/\/+$/, '') ||
        'http://localhost:8000';

      console.log(DEBUG_PREFIX, 'creating Echo instance', {
        appKey,
        host,
        port,
        apiBase,
      });

      if (!appKey) {
        const msg = 'Missing VITE_REVERB_APP_KEY';
        console.error(DEBUG_PREFIX, msg);
        dispatch(wsError(msg));
        setState({
          backend: 'reverb',
          status: 'error',
          lastEvent: { type: 'config_error', message: msg },
        });
        return;
      }

      try {
        globalEcho = new Echo({
          broadcaster: 'pusher',
          key: appKey,
          wsHost: host,
          wsPort: port,
          wssPort: port,
          forceTLS: false, // اگر wss/https راه انداختی اینو true کن
          enabledTransports: ['ws'],
          disabledTransports: ['xhr_polling', 'xhr_streaming'],
          cluster: 'mt1',
          authEndpoint: `${apiBase}/broadcasting/auth`,
          auth: {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          },
        });

        // فقط اگر دوست داشتی، برای دیباگ
        window.__echo = globalEcho;
      } catch (e) {
        console.error(DEBUG_PREFIX, 'error creating Echo', e);
        const msg = e?.message || 'Error creating Echo instance';
        dispatch(wsError(msg));
        setState({
          backend: 'reverb',
          status: 'error',
          lastEvent: { type: 'create_error', error: msg },
        });
        return;
      }

      console.log(DEBUG_PREFIX, 'Echo created, binding connection events');

      const pusher = globalEcho.connector?.pusher;
      if (!pusher || !pusher.connection) {
        console.error(
          DEBUG_PREFIX,
          'pusher.connection is missing – check Echo config',
        );
      } else {
        pusher.connection.bind('connected', () => {
          console.log(DEBUG_PREFIX, '>> CONNECTION CONNECTED');
          setState((s) => ({
            ...s,
            backend: 'reverb',
            status: 'connected',
          }));
          dispatch(wsConnected());
        });

        pusher.connection.bind('disconnected', () => {
          console.log(DEBUG_PREFIX, '>> CONNECTION DISCONNECTED');
          setState((s) => ({
            ...s,
            backend: 'reverb',
            status: 'disconnected',
          }));
          dispatch(wsDisconnected());
        });

        pusher.connection.bind('error', (err) => {
          console.error(DEBUG_PREFIX, '>> CONNECTION ERROR', err);
          setState((s) => ({
            ...s,
            backend: 'reverb',
            status: 'error',
            lastEvent: err,
          }));
          dispatch(wsError(err?.data || err?.message || 'WS connection error'));
        });

        pusher.connection.bind('failed', (err) => {
          console.error(DEBUG_PREFIX, '>> CONNECTION FAILED', err);
          setState((s) => ({
            ...s,
            backend: 'reverb',
            status: 'error',
            lastEvent: err,
          }));
          dispatch(
            wsError(err?.data || err?.message || 'WS connection failed'),
          );
        });
      }
    }

    // وقتی تازه ساختیم هنوز ممکنه در حالت connecting باشه
    setState((s) => ({
      ...s,
      backend: 'reverb',
      status: s.status === 'connected' ? s.status : 'connecting',
    }));

    return () => {
      console.log(DEBUG_PREFIX, 'cleanup effect (deps change)');
      // 👈 اینجا عمداً disconnect نمی‌کنیم
      // چون اگر backendKind هنوز 'reverb' و token داریم،
      // بهتره connection زنده بمونه.
      // قطع کامل فقط در if بالا (وقتی isReverb/hasToken false بشه) انجام میشه.
    };
  }, [backendKind, token, dispatch, debugLabel]);

  /* -------------------- API برای بقیهٔ اپ -------------------- */

  const sendRaw = useCallback(
    (event, payload, channelName) => {
      console.log(DEBUG_PREFIX, 'sendRaw called', {
        event,
        payload,
        channelName,
        status: state.status,
      });

      if (state.status !== 'connected') {
        console.log(DEBUG_PREFIX, 'sendRaw blocked: status != connected', {
          status: state.status,
        });
        return;
      }

      if (!globalEcho || !globalEcho.connector?.pusher) {
        console.log(DEBUG_PREFIX, 'sendRaw: no echo/pusher instance yet', {
          event,
          channelName,
          hasEcho: !!globalEcho,
          hasPusher: !!globalEcho?.connector?.pusher,
        });
        return;
      }

      try {
        console.log(DEBUG_PREFIX, 'sendRaw → send_event', {
          event,
          channelName,
          payload,
        });
        // 👈 این ترتیب درستش برای Reverb/Pusher
        globalEcho.connector.pusher.send_event(event, payload, channelName);
      } catch (e) {
        console.error(DEBUG_PREFIX, 'sendRaw error', e);
      }
    },
    [state.status],
  );


  const subscribe = useCallback((channelName) => {
    if (!globalEcho) {
      console.warn(DEBUG_PREFIX, 'subscribe called but no globalEcho yet', {
        channelName,
      });
      return null;
    }
    try {
      const ch = globalEcho.channel(channelName);
      console.log(DEBUG_PREFIX, 'subscribed to', channelName, '→', ch);
      return ch;
    } catch (e) {
      console.error(DEBUG_PREFIX, 'subscribe error', e);
      return null;
    }
  }, []);

  const leave = useCallback((channelName) => {
    if (!globalEcho) return;
    try {
      console.log(DEBUG_PREFIX, 'leave channel', channelName);
      globalEcho.leave(channelName);
    } catch (e) {
      console.error(DEBUG_PREFIX, 'leave error', e);
    }
  }, []);

  return {
    backend: state.backend,
    status: state.status,
    lastEvent: state.lastEvent,
    sendRaw,
    subscribe,
    leave,
    echo: globalEcho,
  };
}
