// src/hooks/useReverbEcho.js
import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { wsConnected, wsDisconnected, wsError } from '@/store/wsActions';

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

const WS_DEBUG_PREFIX = '[ReverbWS]';
const LOG = Boolean(import.meta.env.VITE_WS_DEBUG) && import.meta.env.DEV;

const stripBearer = (t) => String(t || '').replace(/^Bearer\s+/i, '').trim();

let echoInstance = null;
let echoTokenSig = null;

export default function useReverbEcho({
  enabled,
  token,
  debugLabel = 'useReverbEcho',
} = {}) {
  const dispatch = useDispatch();

  // keep latest props for logs
  const labelRef = useRef(debugLabel);
  useEffect(() => {
    labelRef.current = debugLabel;
  }, [debugLabel]);

  useEffect(() => {
    // Pusher global (once)
    if (typeof window !== 'undefined' && !window.Pusher) {
      window.Pusher = Pusher;
    }

    const isEnabled = !!enabled;
    const bare = stripBearer(token);
    const hasToken = !!bare;

    if (LOG) {
      console.log(WS_DEBUG_PREFIX, 'effect', {
        debugLabel,
        enabled: isEnabled,
        hasToken,
      });
    }

    // helper: dispose
    const dispose = () => {
      if (!echoInstance) return;
      try {
        echoInstance.disconnect();
      } catch (e) {
        if (LOG) console.warn(WS_DEBUG_PREFIX, 'disconnect error', e);
      }
      echoInstance = null;
      echoTokenSig = null;
      if (typeof window !== 'undefined') window.__echo = undefined;
      dispatch(wsDisconnected());
      if (LOG) console.log(WS_DEBUG_PREFIX, 'disposed', labelRef.current);
    };

    if (!isEnabled || !hasToken) {
      if (!isEnabled && LOG) console.log(WS_DEBUG_PREFIX, 'disabled → dispose');
      if (isEnabled && !hasToken) dispatch(wsError('No token for Reverb auth'));
      dispose();
      return;
    }

    const appKey = import.meta.env.VITE_REVERB_APP_KEY;
    const host = import.meta.env.VITE_REVERB_HOST || window.location.hostname;
    const port = Number(import.meta.env.VITE_REVERB_PORT || 8080);
    const apiBase =
      import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:8000';

    if (!appKey) {
      dispatch(wsError('Missing VITE_REVERB_APP_KEY'));
      return;
    }

    // signature prevents re-create loops
    const tokenSig = `Bearer ${bare}`;
    const needRecreate = !echoInstance || echoTokenSig !== tokenSig;

    if (!needRecreate) {
      // already have a valid echo
      if (LOG) console.log(WS_DEBUG_PREFIX, 'reuse existing echo', labelRef.current);
      return;
    }

    // recreate
    dispose();

    if (LOG) {
      console.log(WS_DEBUG_PREFIX, 'creating Echo', {
        debugLabel,
        host,
        port,
        apiBase,
        authEndpoint: `${apiBase}/api/broadcasting/auth`,
      });
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

        // ✅ شما الان route را زیر api هم داری + middleware=auth:sanctum
        authEndpoint: `${apiBase}/api/broadcasting/auth`,

        auth: {
          headers: {
            Authorization: tokenSig,
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        },
      });

      echoTokenSig = tokenSig;
      window.__echo = echoInstance;

      const conn = echoInstance?.connector?.pusher?.connection;

      if (!conn) {
        dispatch(wsError('Reverb: pusher connection missing'));
      } else {
        conn.bind('connected', () => {
          if (LOG) console.log(WS_DEBUG_PREFIX, 'connected', labelRef.current);
          dispatch(wsConnected());
        });

        conn.bind('disconnected', () => {
          if (LOG) console.log(WS_DEBUG_PREFIX, 'disconnected', labelRef.current);
          dispatch(wsDisconnected());
        });

        conn.bind('error', (err) => {
          if (LOG) console.warn(WS_DEBUG_PREFIX, 'error', err);
          dispatch(wsError(err?.data || err?.message || 'WS connection error'));
        });

        conn.bind('failed', (err) => {
          if (LOG) console.warn(WS_DEBUG_PREFIX, 'failed', err);
          dispatch(wsError(err?.data || err?.message || 'WS connection failed'));
        });
      }
    } catch (e) {
      dispatch(wsError(e?.message || 'Error creating Echo instance'));
      dispose();
    }

    return () => {
      if (LOG) console.log(WS_DEBUG_PREFIX, 'cleanup', labelRef.current);
      dispose();
    };
  }, [enabled, token, dispatch]);
}
