// src/hooks/useRoomTransport.js
import { useEffect, useState, useCallback, useRef } from 'react';

const RT_DEBUG = '[RoomTransport]';
const DEFAULT_TYPING_THROTTLE_MS = 800;

export default function useRoomTransport({
  backendKind,
  roomId,
  accessToken, // unused here (keep for future)
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

  const safeNotify = useCallback((packet) => {
    try {
      notifyRef.current?.(packet);
    } catch (e) {
      console.error(RT_DEBUG, 'handleNotification error', e);
    }
  }, []);

  // ✅ your server logs show: private-chat.1 (wire)
  // Echo private('chat.1')  => wire: private-chat.1
  const channelName = roomId ? `chat.${roomId}` : null;

  /* ------------------------------------------------------------------
   * 🔌 subscribe
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (backend !== 'reverb') {
      subscribedRef.current = null;
      setStatus('off');
      setConnectionLabel('WS off');
      return;
    }

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
      ch = echo.private(channelName);
      subscribedRef.current = channelName;
      console.log(RT_DEBUG, '[Reverb] subscribed', channelName);
    } catch (e) {
      console.error(RT_DEBUG, '[Reverb] subscribe failed', e);
      setStatus('error-subscribe');
      setConnectionLabel(`Reverb: subscribe error ${channelName}`);
      return;
    }

    // ✅ Server broadcast event for new messages
    // Backend must broadcastAs('ChatMessageCreated') or event name 'ChatMessageCreated'
    const onMessage = (payload) => {
      console.log(RT_DEBUG, '[Reverb] message event received', payload);

      safeNotify(
        payload?.type
          ? payload
          : {
              type: 'message',
              message: payload?.message || payload,
            },
      );
    };

    // primary (your intended)
    ch.listen('.ChatMessageCreated', onMessage);

    // fallback (if backend didn’t broadcastAs, sometimes Echo uses default event name)
    // (safe: if it doesn't exist, nothing happens)
    ch.listen('ChatMessageCreated', onMessage);

    // ✅ typing is PURE whisper (keep as-is)
    ch.listenForWhisper('typing', (payload) => {
      safeNotify({
        type: 'typing_indicator',
        room_id: roomId,
        user_id: payload?.user_id,
      });
    });

    setStatus('connected');
    setConnectionLabel(`Reverb ${channelName}`);

    return () => {
      console.log(RT_DEBUG, '[Reverb] cleanup leave', channelName);
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

  /* ------------------------------------------------------------------
   * ✉️ sendMessage (client event -> backend should save + broadcast)
   * ------------------------------------------------------------------ */
  // inside useRoomTransport.js

const API =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:8000';

const stripBearer = (t) => String(t || '').replace(/^Bearer\s+/i, '').trim();

const sendMessage = useCallback(
  async (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;

    if (backend !== 'reverb') throw new Error(`Unsupported backend: ${backend}`);
    if (!roomId) throw new Error('No roomId for sendMessage');
    if (!currentUserId) throw new Error('No currentUserId for sendMessage');

    const token = stripBearer(accessToken);
    if (!token) throw new Error('No access token');

    // ✅ این endpoint باید در Laravel وجود داشته باشد
    const url = `${API}/api/chat/rooms/${roomId}/messages`;

    console.log(RT_DEBUG, '[HTTP] sendMessage', { url, roomId, textLen: trimmed.length });

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

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`sendMessage failed ${resp.status}: ${body.slice(0, 200)}`);
    }

    // اختیاری: اگر backend پیام را برگرداند
    // const data = await resp.json().catch(() => null);
    // console.log(RT_DEBUG, '[HTTP] sendMessage OK', data);
  },
  [backend, roomId, currentUserId, accessToken],
);


  /* ------------------------------------------------------------------
   * ⌨️ sendTyping (PURE whisper, no DB, no backend listener)  ✅ DO NOT CHANGE
   * ------------------------------------------------------------------ */
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
