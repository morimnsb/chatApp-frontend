// src/hooks/useUserEvents.js
import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { getOrCreateEcho } from '@/reverb/echo';
import { updateMessages } from '@/actions/messageActions';
import { toast } from 'react-toastify';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';

const log = (...a) => console.log('[UserEvents]', ...a);
const dlog = (...a) => DEBUG && console.log('[UserEvents][DBG]', ...a);

const EVENTS = ['.direct.message'];

export default function useUserEvents({
  effectiveKind,
  accessToken,
  currentUserId,
  selectedRoomId = null,
}) {
  const dispatch = useDispatch();

  // ✅ فقط برای toast، نه برای resubscribe
  const selectedRoomRef = useRef(selectedRoomId);
  useEffect(() => {
    selectedRoomRef.current = selectedRoomId;
  }, [selectedRoomId]);

  const subRef = useRef({
    key: null,            // ✅ مهم: کلید اشتراک
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
    // ✅ کلید پایدار: کل توکن را نذار، فقط یک slice که ثابت می‌ماند
    const tokenKey = tokenStr ? tokenStr.slice(0, 18) : '';
    const channelName = currentUserId != null ? `user.${currentUserId}` : null;

    const nextKey = isReverb && hasToken && hasUserId ? `${kind}|${channelName}|${tokenKey}` : null;

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
        subRef.current = { key: null, echo: null, channelName: null, channel: null, binds: [], connBound: prev.connBound };
        return;
      }

      // stopListening
      for (const ev of EVENTS) {
        try {
          prev.channel.stopListening(ev);
          dlog('stopListening ok', ev);
        } catch (e) {
          dlog('stopListening failed', ev, e);
        }
      }

      // unbind_global
      try {
        const pch = prev.channel?.pusher?.channels?.channels?.[`private-${prev.channelName}`];
        prev.binds.forEach((fn) => {
          try { pch?.unbind_global?.(fn); } catch {}
        });
      } catch {}

      // ✅ leave واقعی
      try {
        prev.echo.leave(`private-${prev.channelName}`);
        dlog('echo.leave ok', `private-${prev.channelName}`);
      } catch (e) {
        dlog('echo.leave failed', e);
      }

      subRef.current = { key: null, echo: null, channelName: null, channel: null, binds: [], connBound: prev.connBound };
    };

    // not ready
    if (!nextKey) {
      log('not ready -> cleanup');
      cleanup();
      return;
    }

    // ✅ اگر کلید عوض نشده، هیچ کاری نکن (حتی اگر selectedRoom تغییر کرد)
    if (subRef.current.key === nextKey && subRef.current.channel) {
      log('same key -> skip resubscribe ✅', { key: nextKey });
      return;
    }

    // (کلید عوض شده) → باید دوباره بسازیم
    cleanup();

    const echo = getOrCreateEcho(accessToken);
    if (!echo) {
      log('getOrCreateEcho returned null -> cleanup');
      cleanup();
      return;
    }

    // connection debug فقط یکبار
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

    // bind_global (اگر موجود بود)
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
        log('bind_global not available ⚠️');
      }
    } catch (e) {
      log('bind_global failed', e);
    }

    // listen
    EVENTS.forEach((ev) => {
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

        const activeRoom = selectedRoomRef.current;
        if (!activeRoom || Number(activeRoom) !== Number(roomId)) {
          toast.info(preview ? `${fromName || 'New message'}: ${preview}` : (fromName || 'New message'));
        } else {
          dlog('toast skipped (room active)', { activeRoom, roomId });
        }
      });
      log('listen attached ✅', ev);
    });

    subRef.current = { key: nextKey, echo, channelName, channel, binds, connBound: subRef.current.connBound };

    return cleanup;

    // ✅ مهم: selectedRoomId اینجا نیست
  }, [dispatch, effectiveKind, accessToken, currentUserId]);
}

function safePreview(x) {
  try {
    const s = JSON.stringify(x);
    return s.length > 220 ? s.slice(0, 220) + '…' : s;
  } catch {
    return String(x);
  }
}
