// src/hooks/useReverbEcho.js
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { wsConnected, wsDisconnected, wsError } from '@/store/wsActions';

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

const WS_DEBUG_PREFIX = '[Reverb WS]';
let echoInstance = null;

export default function useReverbEcho({
  enabled,
  token,
  debugLabel = 'useReverbEcho',
} = {}) {
  const dispatch = useDispatch();

  useEffect(() => {
    console.log(WS_DEBUG_PREFIX, 'effect start', {
      enabled,
      hasToken: !!token,
      debugLabel,
    });

    if (!enabled) {
      console.log(WS_DEBUG_PREFIX, 'disabled → disconnect if exists');
      if (echoInstance) {
        try {
          echoInstance.disconnect();
        } catch (e) {
          console.error(WS_DEBUG_PREFIX, 'error on disconnect old echo', e);
        }
        echoInstance = null;
        window.__echo = undefined;
      }
      dispatch(wsDisconnected());
      return;
    }

    if (!token) {
      console.warn(WS_DEBUG_PREFIX, 'enabled BUT no token → skip connect');
      dispatch(wsError('No token for Reverb auth'));
      return;
    }

    const appKey = import.meta.env.VITE_REVERB_APP_KEY;
    const host = import.meta.env.VITE_REVERB_HOST || window.location.hostname;
    const port = Number(import.meta.env.VITE_REVERB_PORT || 8080);
    const apiBase =
      import.meta.env.VITE_API_URL?.replace(/\/+$/, '') ||
      'http://localhost:8000';

    console.log(WS_DEBUG_PREFIX, 'creating Echo instance with config:', {
      appKey,
      host,
      port,
      apiBase,
    });

    if (!appKey) {
      console.error(WS_DEBUG_PREFIX, '❌ VITE_REVERB_APP_KEY is missing');
      dispatch(wsError('Missing VITE_REVERB_APP_KEY'));
      return;
    }

    if (echoInstance) {
      try {
        echoInstance.disconnect();
      } catch (e) {
        console.error(WS_DEBUG_PREFIX, 'error on disconnect old echo', e);
      }
      echoInstance = null;
      window.__echo = undefined;
    }

    try {
      echoInstance = new Echo({
        broadcaster: 'pusher',
        key: appKey,
        wsHost: host,
        wsPort: port,
        wssPort: port,
        forceTLS: false,
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

      // 🔥 این خط باید اجرا بشه
      window.__echo = echoInstance;
      console.log(WS_DEBUG_PREFIX, 'window.__echo set =', !!window.__echo);

      const pusher = echoInstance.connector?.pusher;

      if (!pusher || !pusher.connection) {
        console.error(
          WS_DEBUG_PREFIX,
          'pusher.connection is missing – check Echo config',
        );
      } else {
        pusher.connection.bind('connected', () => {
          console.log(WS_DEBUG_PREFIX, '>> CONNECTION CONNECTED');
          dispatch(wsConnected());
        });

        pusher.connection.bind('disconnected', () => {
          console.log(WS_DEBUG_PREFIX, '>> CONNECTION DISCONNECTED');
          dispatch(wsDisconnected());
        });

        pusher.connection.bind('error', (err) => {
          console.error(WS_DEBUG_PREFIX, '>> CONNECTION ERROR', err);
          dispatch(wsError(err?.data || err?.message || 'WS connection error'));
        });

        pusher.connection.bind('failed', (err) => {
          console.error(WS_DEBUG_PREFIX, '>> CONNECTION FAILED', err);
          dispatch(
            wsError(err?.data || err?.message || 'WS connection failed'),
          );
        });
      }

      try {
        const testChannel = echoInstance.channel('public.test');
        console.log(
          WS_DEBUG_PREFIX,
          'subscribed to test channel:',
          testChannel,
        );
      } catch (e) {
        console.warn(
          WS_DEBUG_PREFIX,
          'could not subscribe to test channel (ok if not exists)',
          e,
        );
      }
    } catch (e) {
      console.error(WS_DEBUG_PREFIX, '❌ error creating Echo instance', e);
      dispatch(wsError(e?.message || 'Error creating Echo instance'));
    }

    return () => {
      console.log(WS_DEBUG_PREFIX, 'cleanup effect (unmount / deps change)');
      if (echoInstance) {
        try {
          echoInstance.disconnect();
        } catch (e) {
          console.error(WS_DEBUG_PREFIX, 'error on cleanup disconnect', e);
        }
        echoInstance = null;
        window.__echo = undefined;
      }
      dispatch(wsDisconnected());
    };
  }, [enabled, token, dispatch, debugLabel]);
}
