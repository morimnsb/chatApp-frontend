// src/hooks/useRoomTransport.js
import { useEffect, useState, useCallback, useRef } from 'react';

const RT_DEBUG = '[RoomTransport]';

export default function useRoomTransport({
  backendKind,
  roomId,
  accessToken, // فعلاً برای Reverb مستقیم استفاده نمی‌کنیم، ولی می‌مونه
  handleNotification,
  currentUserId,
}) {
  const [status, setStatus] = useState('off');
  const [connectionLabel, setConnectionLabel] = useState('—');

  const backend = String(backendKind || '').toLowerCase();

  // برای جلوگیری از re-subscribe بی‌خودی
  const subscribedRoomRef = useRef(null);

  /* ------------------------------------------------------------------
   *  🔌 Reverb (Laravel)
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (backend !== 'reverb') {
      if (status !== 'off') {
        console.log(RT_DEBUG, '[Reverb] backend != reverb → turning off', {
          backend,
        });
      }
      setStatus('off');
      setConnectionLabel('WS off (backend != reverb)');
      return;
    }

    if (!roomId) {
      console.log(RT_DEBUG, '[Reverb] no roomId → cannot subscribe');
      setStatus('idle');
      setConnectionLabel('No roomId');
      return;
    }

    const echo = window.__echo;
    console.log(RT_DEBUG, '[Reverb] effect start', {
      roomId,
      hasEcho: !!echo,
      backend,
    });

    if (!echo) {
      console.warn(
        RT_DEBUG,
        '[Reverb] window.__echo is missing – global Reverb not ready',
      );
      setStatus('error-no-echo');
      setConnectionLabel('Reverb: no echo');
      return;
    }

    const channelName = `chat.${roomId}`;

    // اگر قبلاً روی همین اتاق subscribe شده‌ایم، دوباره نرو
    if (subscribedRoomRef.current === channelName) {
      console.log(RT_DEBUG, '[Reverb] already subscribed to', channelName);
      setStatus('connected');
      setConnectionLabel(`Reverb chat.${roomId}`);
      return;
    }

    setStatus('subscribing');
    setConnectionLabel(`Reverb: subscribing chat.${roomId}`);

    let channel;

    try {
      channel = echo.channel(channelName);
      console.log(
        RT_DEBUG,
        '[Reverb] subscribed to',
        channelName,
        '→ channel =',
        channel,
      );
      subscribedRoomRef.current = channelName;
    } catch (e) {
      console.error(RT_DEBUG, '[Reverb] error subscribing to', channelName, e);
      setStatus('error-subscribe');
      setConnectionLabel(`Reverb: subscribe error chat.${roomId}`);
      return;
    }

    // 🎧 اینجا eventهایی که از backend می‌آد رو گوش می‌دیم
    // اسامی رو باید با Laravel هماهنگ کنی

    channel
      // مثلا: Broadcast::event(new ChatMessageBroadcasted(...))->broadcastAs('ChatMessage')
      .listen('.ChatMessage', (packet) => {
        console.log(RT_DEBUG, '[Reverb] .ChatMessage event received', packet);
        handleNotification?.(packet);
      })
      .listen('.ChatMessageBroadcasted', (packet) => {
        console.log(
          RT_DEBUG,
          '[Reverb] .ChatMessageBroadcasted event received',
          packet,
        );
        handleNotification?.(packet);
      })
      .listen('.TypingIndicator', (packet) => {
        console.log(
          RT_DEBUG,
          '[Reverb] .TypingIndicator event received',
          packet,
        );
        handleNotification?.(packet);
      })
      .listen('.MessageReceived', (packet) => {
        console.log(
          RT_DEBUG,
          '[Reverb] .MessageReceived event received',
          packet,
        );
        handleNotification?.(packet);
      });

    // برای دیباگ: همه ی eventها
    channel.listenForWhisper('typing', (payload) => {
      console.log(RT_DEBUG, '[Reverb] whisper:typing received', payload);
      handleNotification?.({
        type: 'typing_indicator',
        room_id: roomId,
        user_id: payload?.user_id,
      });
    });

    setStatus('connected');
    setConnectionLabel(`Reverb chat.${roomId}`);

    return () => {
      console.log(RT_DEBUG, '[Reverb] cleanup leave', channelName);
      try {
        echo.leave(channelName);
      } catch (e) {
        console.error(RT_DEBUG, '[Reverb] error on leave', channelName, e);
      }
      if (subscribedRoomRef.current === channelName) {
        subscribedRoomRef.current = null;
      }
      setStatus('idle');
      setConnectionLabel('Reverb: idle');
    };
  }, [backend, roomId, handleNotification, status]);

  /* ------------------------------------------------------------------
   *  ✉️ sendMessage → فقط WebSocket (Reverb)
   * ------------------------------------------------------------------ */

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = String(text || '').trim();
      if (!trimmed) {
        console.log(RT_DEBUG, 'sendMessage called with empty text – ignore');
        return;
      }

      console.log(RT_DEBUG, 'sendMessage called', {
        backend,
        roomId,
        currentUserId,
        text: trimmed,
      });

      if (!roomId) {
        console.warn(RT_DEBUG, 'sendMessage without roomId – abort');
        throw new Error('No roomId for sendMessage');
      }

      if (backend === 'reverb') {
        const echo = window.__echo;
        if (!echo) {
          console.error(
            RT_DEBUG,
            '[Reverb] sendMessage – no window.__echo, cannot send',
          );
          throw new Error('Reverb not connected (no echo)');
        }

        const pusher = echo.connector?.pusher;
        console.log(RT_DEBUG, '[Reverb] pusher in sendMessage', {
          hasPusher: !!pusher,
          connectionState: pusher?.connection?.state,
        });

        if (!pusher) {
          throw new Error('Reverb pusher connector missing');
        }

        const channelName = `chat.${roomId}`;
        const payload = {
          content: trimmed,
          user_id: currentUserId ?? null,
          room_id: roomId,
        };

        console.log(RT_DEBUG, '[Reverb] send_event payload', {
          event: 'ClientChatMessage',
          channelName,
          payload,
        });

        try {
          pusher.send_event('ClientChatMessage', payload, channelName);
          console.log(RT_DEBUG, '[Reverb] send_event dispatched OK');
        } catch (e) {
          console.error(RT_DEBUG, '[Reverb] send_event FAILED', e);
          throw e;
        }

        return;
      }

      if (backend === 'django') {
        console.log(
          RT_DEBUG,
          '[Django] sendMessage – not implemented yet (you will adapt it)',
          { roomId, text: trimmed },
        );
        throw new Error('Django WS sendMessage not implemented yet');
      }

      console.warn(RT_DEBUG, 'sendMessage called with unsupported backend', {
        backend,
      });
      throw new Error(`Unsupported backend: ${backend}`);
    },
    [backend, roomId, currentUserId],
  );

  /* ------------------------------------------------------------------
   *  ⌨️ sendTyping → WebSocket
   * ------------------------------------------------------------------ */

  const sendTyping = useCallback(
    (userId) => {
      console.log(RT_DEBUG, 'sendTyping called', {
        backend,
        roomId,
        userId,
      });

      if (!userId || !roomId) return;

      if (backend === 'reverb') {
        const echo = window.__echo;
        const pusher = echo?.connector?.pusher;
        if (!pusher) {
          console.warn(
            RT_DEBUG,
            '[Reverb] sendTyping – no pusher, skip typing event',
          );
          return;
        }

        const channelName = `chat.${roomId}`;
        const payload = {
          room_id: roomId,
          user_id: userId,
        };

        console.log(RT_DEBUG, '[Reverb] send_event typing payload', {
          event: 'ClientTyping',
          channelName,
          payload,
        });

        try {
          pusher.send_event('ClientTyping', payload, channelName);
          console.log(RT_DEBUG, '[Reverb] typing send_event dispatched OK');
        } catch (e) {
          console.error(RT_DEBUG, '[Reverb] typing send_event FAILED', e);
        }
        return;
      }

      if (backend === 'django') {
        console.log(
          RT_DEBUG,
          '[Django] sendTyping – not implemented yet (ok for now)',
        );
        return;
      }
    },
    [backend, roomId],
  );

  return {
    status,
    connectionLabel,
    sendMessage,
    sendTyping,
  };
}
