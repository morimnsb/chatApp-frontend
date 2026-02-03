// chatApp-frontend/src/features/chat/hooks/useUserEvents.js
import { useEffect, useRef } from 'react';
import { getOrCreateEcho } from '@/shared/config/realtime.js';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';

const log = (...a) => console.log('[UserEvents]', ...a);
const dlog = (...a) => DEBUG && console.log('[UserEvents][DBG]', ...a);

const EVENTS = ['.direct.message', 'direct.message'];

function safePreview(x, n = 220) {
  try {
    const s = JSON.stringify(x);
    return s.length > n ? s.slice(0, n) + '…' : s;
  } catch {
    return String(x);
  }
}

export default function useUserEvents({
  effectiveKind,
  accessToken,
  currentUserId,
  selectedRoomId = null, // فقط برای log
  onNotify,
}) {
  const selectedRoomRef = useRef(selectedRoomId);
  useEffect(() => {
    selectedRoomRef.current = selectedRoomId;
  }, [selectedRoomId]);

  const onNotifyRef = useRef(onNotify);
  useEffect(() => {
    onNotifyRef.current = onNotify;
  }, [onNotify]);

  // subscription state
  const subRef = useRef({
    key: null,
    echo: null,
    channelName: null, // e.g. "user.4" (بدون private-)
    channel: null,
    binds: [],
    connHandlers: null, // { onStateChange, onConnected, onError }
    connBound: false,
  });

  useEffect(() => {
    const kind = String(effectiveKind || '').toLowerCase();
    const isReverb = kind === 'reverb';
    const hasToken = Boolean(accessToken);
    const hasUserId = Number(currentUserId) > 0;

    const tokenStr = accessToken ? String(accessToken) : '';
    const tokenKey = tokenStr ? tokenStr.slice(0, 18) : '';

    const channelName = hasUserId ? `user.${Number(currentUserId)}` : null;

    const nextKey = isReverb && hasToken && hasUserId ? `${kind}|${channelName}|${tokenKey}` : null;

    log('effect()', {
      kind,
      isReverb,
      hasToken,
      currentUserId,
      selectedRoomId: selectedRoomRef.current,
      nextKey,
    });

    const cleanup = (reason = 'cleanup') => {
      const prev = subRef.current;

      log('cleanup()', {
        reason,
        key: prev.key,
        hasEcho: Boolean(prev.echo),
        channelName: prev.channelName,
        hasChannel: Boolean(prev.channel),
      });

      // 1) stopListening
      if (prev.channel) {
        for (const ev of EVENTS) {
          try {
            prev.channel.stopListening(ev);
            dlog('stopListening ok', ev);
          } catch (e) {
            dlog('stopListening failed', ev, e);
          }
        }
      }

      // 2) unbind_global
      try {
        const pch = prev.channel?.pusher?.channels?.channels?.[`private-${prev.channelName}`];
        prev.binds?.forEach((fn) => {
          try {
            pch?.unbind_global?.(fn);
          } catch {}
        });
      } catch {}

      // 3) ✅ leave channel (IMPORTANT: بدون prefix!)
      if (prev.echo && prev.channelName) {
        try {
          // Echo خودش private- رو مدیریت می‌کنه
          prev.echo.leave(prev.channelName);
          dlog('echo.leave ok', prev.channelName);
        } catch (e) {
          dlog('echo.leave failed', e);
        }
      }

      // 4) unbind connection handlers (فقط اگر bind کرده بودیم)
      try {
        const conn = prev.echo?.connector?.pusher?.connection;
        const h = prev.connHandlers;
        if (conn && h) {
          conn.unbind?.('state_change', h.onStateChange);
          conn.unbind?.('connected', h.onConnected);
          conn.unbind?.('error', h.onError);
        }
      } catch {}

      subRef.current = {
        key: null,
        echo: prev.echo || null, // echo رو نگه می‌داریم (disconnect نمی‌کنیم)
        channelName: null,
        channel: null,
        binds: [],
        connHandlers: null,
        connBound: prev.connBound, // فقط برای جلوگیری از bind تکراری
      };
    };

    if (!nextKey) {
      log('not ready -> cleanup');
      cleanup('not-ready');
      return undefined;
    }

    if (subRef.current.key === nextKey && subRef.current.channel) {
      log('same key -> skip resubscribe ✅', { key: nextKey });
      return undefined;
    }

    // پاکسازی قبلی
    cleanup('before-subscribe');

    const echo = getOrCreateEcho(accessToken);
    if (!echo) {
      log('getOrCreateEcho returned null -> cleanup');
      cleanup('no-echo');
      return undefined;
    }

    const conn = echo.connector?.pusher?.connection;

    const doSubscribe = () => {
      // اگر وسط کار key عوض شد، subscribe نکن
      if (subRef.current.key && subRef.current.key !== nextKey) return;

      log('subscribing', { channelName });

      let channel;
      try {
        channel = echo.private(channelName);
      } catch (e) {
        log('echo.private failed', e);
        return;
      }

      // bind_global (برای debug نام واقعی event)
      const binds = [];
      try {
        const pusherChannel = channel?.pusher?.channels?.channels?.[`private-${channelName}`];
        if (pusherChannel?.bind_global) {
          const fn = (eventName, data) => {
            log('GLOBAL EVENT on user channel', {
              eventName,
              dataPreview: safePreview(data),
            });
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

      // listen events
      EVENTS.forEach((ev) => {
        try {
          channel.listen(ev, (payload) => {
            log('EVENT RECEIVED ✅', { ev, payloadPreview: safePreview(payload) });
            try {
              onNotifyRef.current?.(payload);
            } catch (e) {
              console.error('[UserEvents] onNotify error', e);
            }
          });
          log('listen attached ✅', ev);
        } catch (e) {
          log('listen attach failed', { ev, err: String(e?.message || e) });
        }
      });

      subRef.current = {
        key: nextKey,
        echo,
        channelName,
        channel,
        binds,
        connHandlers: subRef.current.connHandlers,
        connBound: subRef.current.connBound,
      };
    };

    // connection debug فقط یک بار
    try {
      if (conn && !subRef.current.connBound) {
        subRef.current.connBound = true;

        const onStateChange = (st) => log('pusher state_change', st);
        const onConnected = () => log('pusher connected', { socket_id: conn.socket_id });
        const onError = (err) => log('pusher error', err);

        subRef.current.connHandlers = { onStateChange, onConnected, onError };

        log('connection state', { state: conn.state, socket_id: conn.socket_id });
        conn.bind?.('state_change', onStateChange);
        conn.bind?.('connected', onConnected);
        conn.bind?.('error', onError);
      }
    } catch (e) {
      log('connection debug failed', e);
    }

    // ✅ subscribe فقط وقتی connected است
    if (conn?.state === 'connected') {
      doSubscribe();
    } else {
      // یکبار وقتی connected شد subscribe کن
      const onceConnected = () => {
        try {
          conn?.unbind?.('connected', onceConnected);
        } catch {}
        doSubscribe();
      };
      try {
        conn?.bind?.('connected', onceConnected);
      } catch {}
    }

    // key را ست کن تا از subscribe اشتباه جلوگیری شود
    subRef.current.key = nextKey;
    subRef.current.echo = echo;

    return () => cleanup('effect-return');
  }, [effectiveKind, accessToken, currentUserId]);

  return null;
}
