// src/hooks/useUserEvents.js
import { useEffect, useRef } from 'react';
import { getOrCreateEcho } from '@/config/realtime';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';

const log = (...a) => console.log('[UserEvents]', ...a);
const dlog = (...a) => DEBUG && console.log('[UserEvents][DBG]', ...a);

// ✅ listen both
const EVENTS = ['.direct.message', 'direct.message'];

export default function useUserEvents({
  effectiveKind,
  accessToken,
  currentUserId,
  selectedRoomId = null,

  // ✅ NEW: callback to global notify
  onNotify,
}) {
  // فقط برای اینکه با تغییر selectedRoomId resubscribe نشه
  const selectedRoomRef = useRef(selectedRoomId);
  useEffect(() => {
    selectedRoomRef.current = selectedRoomId;
  }, [selectedRoomId]);

  // callback ref (تا dependency ها ریساب‌سکرایب نکنن)
  const onNotifyRef = useRef(onNotify);
  useEffect(() => {
    onNotifyRef.current = onNotify;
  }, [onNotify]);

  const subRef = useRef({
    key: null,
    echo: null,
    channelName: null,
    channel: null,
    binds: [],
    connBound: false,
  });

  useEffect(() => {
    const kind = String(effectiveKind || '').toLowerCase();
    const isReverb = kind === 'reverb';
    const hasToken = Boolean(accessToken);
    const hasUserId = currentUserId != null;

    const tokenStr = accessToken ? String(accessToken) : '';
    const tokenKey = tokenStr ? tokenStr.slice(0, 18) : '';
    const channelName = currentUserId != null ? `user.${currentUserId}` : null;

    const nextKey =
      isReverb && hasToken && hasUserId ? `${kind}|${channelName}|${tokenKey}` : null;

    log('effect()', {
      kind,
      isReverb,
      hasToken,
      currentUserId,
      selectedRoomId: selectedRoomRef.current,
      nextKey,
    });

    const cleanup = () => {
      const prev = subRef.current;

      log('cleanup()', {
        key: prev.key,
        hasEcho: Boolean(prev.echo),
        channelName: prev.channelName,
        hasChannel: Boolean(prev.channel),
      });

      if (!prev.echo || !prev.channelName || !prev.channel) {
        subRef.current = {
          key: null,
          echo: null,
          channelName: null,
          channel: null,
          binds: [],
          connBound: prev.connBound,
        };
        return;
      }

      for (const ev of EVENTS) {
        try {
          prev.channel.stopListening(ev);
          dlog('stopListening ok', ev);
        } catch (e) {
          dlog('stopListening failed', ev, e);
        }
      }

      try {
        const pch =
          prev.channel?.pusher?.channels?.channels?.[`private-${prev.channelName}`];
        prev.binds.forEach((fn) => {
          try {
            pch?.unbind_global?.(fn);
          } catch {
            // ignore
          }
        });
      } catch {
        // ignore
      }

      try {
        prev.echo.leave(`private-${prev.channelName}`);
        dlog('echo.leave ok', `private-${prev.channelName}`);
      } catch (e) {
        dlog('echo.leave failed', e);
      }

      subRef.current = {
        key: null,
        echo: null,
        channelName: null,
        channel: null,
        binds: [],
        connBound: prev.connBound,
      };
    };

    if (!nextKey) {
      log('not ready -> cleanup');
      cleanup();
      return undefined;
    }

    if (subRef.current.key === nextKey && subRef.current.channel) {
      log('same key -> skip resubscribe ✅', { key: nextKey });
      return undefined;
    }

    cleanup();

    const echo = getOrCreateEcho(accessToken);
    if (!echo) {
      log('getOrCreateEcho returned null -> cleanup');
      cleanup();
      return undefined;
    }

    // connection debug only once
    try {
      const conn = echo.connector?.pusher?.connection;
      if (conn && !subRef.current.connBound) {
        subRef.current.connBound = true;

        log('connection state', { state: conn.state, socket_id: conn.socket_id });
        conn.bind?.('state_change', (st) => log('pusher state_change', st));
        conn.bind?.('connected', () => log('pusher connected', { socket_id: conn.socket_id }));
        conn.bind?.('error', (err) => log('pusher error', err));
      }
    } catch (e) {
      log('connection debug failed', e);
    }

    log('subscribing', { channelName });

    const channel = echo.private(channelName);

    // bind_global (برای دیدن eventName واقعی)
    const binds = [];
    try {
      const pusherChannel =
        channel?.pusher?.channels?.channels?.[`private-${channelName}`];
      if (pusherChannel?.bind_global) {
        const fn = (eventName, data) => {
          log('GLOBAL EVENT on user channel', { eventName, dataPreview: safePreview(data) });
        };
        pusherChannel.bind_global(fn);
        binds.push(fn);
        log('bind_global attached ✅', { key: `private-${channelName}` });
      } else {
        log('bind_global not available ⚠️');
      }
    } catch (e) {
      log('bind_global failed', e);
    }

    // ✅ listen -> فقط پاس بده به onNotify
    EVENTS.forEach((ev) => {
      channel.listen(ev, (payload) => {
        log('EVENT RECEIVED ✅', { ev, payloadPreview: safePreview(payload) });

        // ✅ فقط یک کار: forward کن
        try {
          onNotifyRef.current?.(payload);
        } catch (e) {
          console.error('[UserEvents] onNotify error', e);
        }
      });

      log('listen attached ✅', ev);
    });

    subRef.current = {
      key: nextKey,
      echo,
      channelName,
      channel,
      binds,
      connBound: subRef.current.connBound,
    };

    return cleanup;
  }, [effectiveKind, accessToken, currentUserId]);

  return null;
}

function safePreview(x) {
  try {
    const s = JSON.stringify(x);
    return s.length > 220 ? s.slice(0, 220) + '…' : s;
  } catch {
    return String(x);
  }
}
