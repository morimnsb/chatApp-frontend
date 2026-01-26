// src/hooks/useReverbEcho.js
import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { wsConnected, wsDisconnected, wsError } from '@/store/wsActions';
import { getOrCreateEcho, disconnectEcho } from '@/reverb/echo';

const WS_DEBUG_PREFIX = '[ReverbWS]';
const DEV = import.meta.env.DEV === true;
const LOG = DEV && String(import.meta.env.VITE_WS_DEBUG || '') === 'true';

const stripBearer = (t) => String(t || '').replace(/^Bearer\s+/i, '').trim();

export default function useReverbEcho({ enabled, token, debugLabel = 'useReverbEcho' } = {}) {
  const dispatch = useDispatch();
  const labelRef = useRef(debugLabel);

  useEffect(() => {
    labelRef.current = debugLabel;
  }, [debugLabel]);

  // برای جلوگیری از bind دوباره‌ی event ها
  const boundRef = useRef(false);

  useEffect(() => {
    const isEnabled = !!enabled;
    const bare = stripBearer(token);
    const hasToken = !!bare;

    if (LOG) {
      console.log(WS_DEBUG_PREFIX, 'effect', {
        debugLabel: labelRef.current,
        enabled: isEnabled,
        hasToken,
        tokenPrefix: hasToken ? bare.slice(0, 10) + '…' : null,
      });
    }

    // dispose helper
    const dispose = () => {
      boundRef.current = false;
      try {
        disconnectEcho();
      } catch {}
      dispatch(wsDisconnected());
      if (LOG) console.log(WS_DEBUG_PREFIX, 'disposed', labelRef.current);
    };

    if (!isEnabled) {
      if (LOG) console.log(WS_DEBUG_PREFIX, 'disabled → dispose', labelRef.current);
      dispose();
      return;
    }

    if (!hasToken) {
      dispatch(wsError('No token for Reverb auth'));
      dispose();
      return;
    }

    // ✅ reuse singleton (create or update auth headers)
    const echo = getOrCreateEcho(bare);

    if (!echo) {
      dispatch(wsError('Failed to create Echo instance'));
      dispose();
      return;
    }

    // expose (optional)
    if (typeof window !== 'undefined') window.__echo = echo;

    const conn = echo?.connector?.pusher?.connection;
    if (!conn) {
      dispatch(wsError('Reverb: pusher connection missing'));
      return;
    }

    // bind once
    if (!boundRef.current) {
      boundRef.current = true;

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

      if (LOG) console.log(WS_DEBUG_PREFIX, 'events bound', labelRef.current);
    } else {
      if (LOG) console.log(WS_DEBUG_PREFIX, 'events already bound', labelRef.current);
    }

    return () => {
      if (LOG) console.log(WS_DEBUG_PREFIX, 'cleanup', labelRef.current);
      // ❗️اینجا disconnect نکن، چون ممکنه جاهای دیگه هم از Echo استفاده کنن
      // اگر واقعاً می‌خوای همیشه قطع بشه، enabled رو false کن.
    };
  }, [enabled, token, dispatch]);
}
