// src/hooks/useUserEvents.js
import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { getOrCreateEcho } from '@/reverb/echo';
import { updateMessages } from '@/actions/messageActions';
import { toast } from 'react-toastify';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';

const log = (...a) => console.log('[UserEvents]', ...a); // ✅ همیشه بزن تا مطمئن بشیم
const dlog = (...a) => DEBUG && console.log('[UserEvents][DBG]', ...a);

export default function useUserEvents({
  effectiveKind,
  accessToken,
  currentUserId,
  selectedRoomId = null,
}) {
  const dispatch = useDispatch();

  const subRef = useRef({
    echo: null,
    channelName: null,
    channel: null,
    isBound: false,
    binds: [],
  });

  useEffect(() => {
    const kind = String(effectiveKind || '').toLowerCase();
    const isReverb = kind === 'reverb';
    const hasToken = Boolean(accessToken);
    const hasUserId = currentUserId != null;

    log('effect()', {
      kind,
      isReverb,
      hasToken,
      currentUserId,
      selectedRoomId,
      tokenPreview: accessToken ? String(accessToken).slice(0, 14) + '...' : null,
    });

    // ✅ مهم: هر دو حالت را امتحان می‌کنیم
    const EVENTS = ['.direct.message', 'direct.message'];

    const cleanup = () => {
      const prev = subRef.current;

      log('cleanup()', {
        hasEcho: Boolean(prev.echo),
        channelName: prev.channelName,
        isBound: prev.isBound,
        hasChannel: Boolean(prev.channel),
      });

      if (!prev.echo || !prev.channelName || !prev.channel) {
        subRef.current = { echo: null, channelName: null, channel: null, isBound: false, binds: [] };
        return;
      }

      try {
        // unbind event listeners
        if (prev.isBound) {
          for (const ev of EVENTS) {
            try {
              prev.channel.stopListening(ev);
              dlog('stopListening ok', ev);
            } catch (e) {
              dlog('stopListening failed', ev, e);
            }
          }

          // unbind any bound callbacks we stored
          try {
            prev.binds.forEach((fn) => {
              try {
                prev.channel.unbind_global?.(fn);
              } catch {}
            });
          } catch {}
        }
      } catch {}

      try {
        // ✅ leave channel
        prev.channel.unsubscribe?.();
        dlog('unsubscribe ok', prev.channelName);
      } catch (e) {
        dlog('unsubscribe failed', e);
      }

      subRef.current = { echo: null, channelName: null, channel: null, isBound: false, binds: [] };
    };

    if (!isReverb || !hasToken || !hasUserId) {
      log('not ready -> cleanup');
      cleanup();
      return;
    }

    const echo = getOrCreateEcho(accessToken);
    if (!echo) {
      log('getOrCreateEcho returned null -> cleanup');
      cleanup();
      return;
    }

    // ✅ connection debug
    try {
      const conn = echo.connector?.pusher?.connection;
      if (conn) {
        log('connection state', {
          state: conn.state,
          socket_id: conn.socket_id,
        });

        // bind state changes
        conn.bind?.('state_change', (st) => log('pusher state_change', st));
        conn.bind?.('connected', () => log('pusher connected', { socket_id: conn.socket_id }));
        conn.bind?.('error', (err) => log('pusher error', err));
      } else {
        log('no pusher connection object found');
      }
    } catch (e) {
      log('connection debug failed', e);
    }

    const channelName = `user.${currentUserId}`;

    const prev = subRef.current;
    if (prev.echo === echo && prev.channelName === channelName && prev.isBound && prev.channel) {
      log('already subscribed -> skip');
      return;
    }

    cleanup();

    log('subscribing', { channelName });

    const channel = echo.private(channelName);

    // ✅ ultra debug: log ANY event on this channel (Pusher has bind_global)
    const binds = [];
    try {
      const pusherChannel = channel?.pusher?.channels?.channels?.[`private-${channelName}`];
      if (pusherChannel?.bind_global) {
        const fn = (eventName, data) => {
          log('GLOBAL EVENT on user channel', { eventName, dataPreview: safePreview(data) });
        };
        pusherChannel.bind_global(fn);
        binds.push(fn);
        log('bind_global attached ✅', { key: `private-${channelName}` });
      } else {
        log('bind_global not available (different echo/pusher impl) ⚠️');
      }
    } catch (e) {
      log('bind_global failed', e);
    }

    // ✅ Listen to both variants
    EVENTS.forEach((ev) => {
      try {
        channel.listen(ev, (payload) => {
          log('EVENT RECEIVED ✅', { ev, payloadPreview: safePreview(payload) });

          const roomId = payload?.room_id ?? payload?.roomId ?? null;
          const msg = payload?.message ?? null;

          const fromId = msg?.user_id ?? msg?.user?.id ?? null;
          const fromName = msg?.user?.name ?? payload?.sender_name ?? null;
          const preview = msg?.content ?? payload?.preview ?? '';

          dispatch(
            updateMessages({
              type: 'message_notify',
              room_id: roomId,
              message: msg,
              message_id: msg?.id ?? payload?.message_id ?? null,
              sender_id: fromId,
              sender_name: fromName,
              preview,
              created_at: msg?.created_at ?? payload?.created_at ?? null,
              raw: payload,
            }),
          );

          if (!selectedRoomId || Number(selectedRoomId) !== Number(roomId)) {
            const title = fromName ? `${fromName}` : 'New message';
            toast.info(preview ? `${title}: ${preview}` : title);
          } else {
            dlog('toast skipped because room is active', { selectedRoomId, roomId });
          }
        });
        log('listen attached ✅', ev);
      } catch (e) {
        log('listen attach FAILED ❌', ev, e);
      }
    });

    subRef.current = { echo, channelName, channel, isBound: true, binds };
    return cleanup;
  }, [dispatch, effectiveKind, accessToken, currentUserId, selectedRoomId]);
}

function safePreview(x) {
  try {
    const s = JSON.stringify(x);
    return s.length > 220 ? s.slice(0, 220) + '…' : s;
  } catch {
    return String(x);
  }
}
