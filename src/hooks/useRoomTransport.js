import { useEffect, useState, useCallback, useRef } from 'react';

const RT_DEBUG = '[RoomTransport]';
const DEFAULT_TYPING_THROTTLE_MS = 800;

const DEV = import.meta.env.DEV === true;
const DEBUG_TRANSPORT = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';

const safeKeys = (obj) => {
  try {
    return obj && typeof obj === 'object' ? Object.keys(obj) : [];
  } catch {
    return [];
  }
};

const previewJson = (obj, max = 420) => {
  try {
    const s = JSON.stringify(obj);
    return s.length > max ? s.slice(0, max) + '…' : s;
  } catch {
    return String(obj);
  }
};

const normalizeIncoming = (payload, roomId) => {
  const raw = payload || {};
  const rawMsg = raw?.message || raw;

  const inferredRoom =
    raw?.room_id ??
    raw?.roomId ??
    rawMsg?.room_id ??
    rawMsg?.roomId ??
    rawMsg?.chat_room_id ??
    roomId ??
    null;

  return {
    type: raw?.type || 'message',
    room_id: inferredRoom,
    roomId: inferredRoom,
    message: rawMsg,
    raw,
  };
};

const stripBearer = (t) => String(t || '').replace(/^Bearer\s+/i, '').trim();

export default function useRoomTransport({
  backendKind,
  roomId,
  accessToken,
  handleNotification,
  currentUserId,
  typingThrottleMs = DEFAULT_TYPING_THROTTLE_MS,
}) {
  const backend = String(backendKind || '').toLowerCase();

  const [status, setStatus] = useState('off');
  const [connectionLabel, setConnectionLabel] = useState('—');

  const notifyRef = useRef(handleNotification);
  useEffect(() => {
    notifyRef.current = handleNotification;
  }, [handleNotification]);

  const subscribedRef = useRef(null);

  const dbgCounterRef = useRef({
    msg: 0,
    typing: 0,
    subscribe: 0,
    cleanup: 0,
  });

  const safeNotify = useCallback((packet) => {
    try {
      if (DEBUG_TRANSPORT) {
        console.log(RT_DEBUG, '[safeNotify] type=', packet?.type, 'roomId=', packet?.roomId);
        console.log(RT_DEBUG, '[safeNotify] preview=', previewJson(packet));
      }
      notifyRef.current?.(packet);
    } catch (e) {
      console.error(RT_DEBUG, 'handleNotification error', e);
    }
  }, []);

  const channelName = roomId ? `chat.${roomId}` : null;

  useEffect(() => {
    if (DEBUG_TRANSPORT) {
      console.log(RT_DEBUG, '[effect] start', {
        backend,
        roomId,
        currentUserId,
        channelName,
        hasEcho: Boolean(window.__echo),
        subscribedRef: subscribedRef.current,
      });
    }

    // فقط Reverb
    if (backend !== 'reverb') {
      subscribedRef.current = null;
      setStatus('off');
      setConnectionLabel('WS off');
      return;
    }

    // صبر تا دیتا آماده شود
    if (!roomId) {
      subscribedRef.current = null;
      setStatus('idle');
      setConnectionLabel('Waiting for room…');
      return;
    }

    if (!currentUserId) {
      subscribedRef.current = null;
      setStatus('idle');
      setConnectionLabel('Waiting for user…');
      return;
    }

    const echo = window.__echo;
    if (!echo) {
      console.warn(RT_DEBUG, '[Reverb] window.__echo missing');
      setStatus('error-no-echo');
      setConnectionLabel('Reverb: no echo');
      return;
    }

    if (subscribedRef.current === channelName) {
      setStatus('connected');
      setConnectionLabel(`Reverb ${channelName}`);
      return;
    }

    setStatus('subscribing');
    setConnectionLabel(`Reverb: subscribing ${channelName}`);

    let ch;
    try {
      dbgCounterRef.current.subscribe += 1;

      ch = echo.private(channelName);
      subscribedRef.current = channelName;

      console.log(RT_DEBUG, '[Reverb] subscribed', {
        channelName,
        subscribeCount: dbgCounterRef.current.subscribe,
        roomId,
        currentUserId,
      });
    } catch (e) {
      console.error(RT_DEBUG, '[Reverb] subscribe failed', e);
      setStatus('error-subscribe');
      setConnectionLabel(`Reverb: subscribe error ${channelName}`);
      return;
    }

    const onMessage = (payload) => {
      dbgCounterRef.current.msg += 1;

      if (DEBUG_TRANSPORT) {
        console.log(RT_DEBUG, '==============================');
        console.log(RT_DEBUG, `[Reverb] RAW event #${dbgCounterRef.current.msg}`);
        console.log(RT_DEBUG, '[RAW keys]=', safeKeys(payload));
        console.log(RT_DEBUG, '[RAW preview]=', previewJson(payload));
      }

      const packet = normalizeIncoming(payload, roomId);
      safeNotify(packet);
    };

    ch.listen('.ChatMessageCreated', onMessage);
    ch.listen('ChatMessageCreated', onMessage);

    ch.listenForWhisper('typing', (payload) => {
      dbgCounterRef.current.typing += 1;

      if (DEBUG_TRANSPORT) {
        console.log(RT_DEBUG, `[Reverb] whisper typing #${dbgCounterRef.current.typing}`, {
          payloadKeys: safeKeys(payload),
          payloadPreview: previewJson(payload),
          roomId,
        });
      }

      safeNotify({
        type: 'typing_indicator',
        room_id: roomId,
        roomId,
        user_id: payload?.user_id,
        raw: payload,
      });
    });

    setStatus('connected');
    setConnectionLabel(`Reverb ${channelName}`);

    return () => {
      dbgCounterRef.current.cleanup += 1;

      console.log(RT_DEBUG, '[Reverb] cleanup leave', {
        channelName,
        cleanupCount: dbgCounterRef.current.cleanup,
        subscribedWas: subscribedRef.current,
      });

      try {
        ch?.stopListening('.ChatMessageCreated');
        ch?.stopListening('ChatMessageCreated');
      } catch {}

      try {
        echo.leave(channelName);
      } catch {}

      if (subscribedRef.current === channelName) subscribedRef.current = null;

      setStatus('idle');
      setConnectionLabel('Reverb: idle');
    };
  }, [backend, roomId, currentUserId, channelName, safeNotify]);

  const API = (import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:8000');

  // ✅ FIXED: send to /api/chatMeetUp/messages/{roomId}
  const sendMessage = useCallback(
    async (text) => {
      const trimmed = String(text || '').trim();
      if (!trimmed) return;

      if (backend !== 'reverb') throw new Error(`Unsupported backend: ${backend}`);
      if (!roomId) throw new Error('No roomId for sendMessage');
      if (!currentUserId) throw new Error('No currentUserId for sendMessage');

      const token = stripBearer(accessToken);
      if (!token) throw new Error('No access token');

      const url = `${API}/api/chatMeetUp/messages/${roomId}`;

      if (DEBUG_TRANSPORT) {
        console.log(RT_DEBUG, '[HTTP] sendMessage', { url, roomId, textLen: trimmed.length });
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ content: trimmed }),
      });
const textBody = await resp.text().catch(() => '');
console.log(RT_DEBUG, '[HTTP] sendMessage resp', {
  ok: resp.ok,
  status: resp.status,
  bodyPreview: textBody.slice(0, 200),
});
if (!resp.ok) {
  throw new Error(`sendMessage failed ${resp.status}: ${textBody.slice(0, 200)}`);
}

      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new Error(`sendMessage failed ${resp.status}: ${body.slice(0, 200)}`);
      }
    },
    [backend, roomId, currentUserId, accessToken, API],
  );

  const lastTypingSentAtRef = useRef(0);

  const sendTyping = useCallback(
    (userId) => {
      if (backend !== 'reverb') return false;
      if (!roomId || !userId) return false;

      const now = Date.now();
      if (now - lastTypingSentAtRef.current < typingThrottleMs) return false;
      lastTypingSentAtRef.current = now;

      const echo = window.__echo;
      if (!echo) return false;

      try {
        if (DEBUG_TRANSPORT) console.log(RT_DEBUG, '[typing] whisper ->', { channelName, userId, at: now });
        echo.private(channelName).whisper('typing', { user_id: userId, at: now });
        return true;
      } catch (e) {
        console.warn(RT_DEBUG, 'typing whisper failed', e);
        return false;
      }
    },
    [backend, roomId, typingThrottleMs, channelName],
  );

  return { status, connectionLabel, sendMessage, sendTyping };
}
