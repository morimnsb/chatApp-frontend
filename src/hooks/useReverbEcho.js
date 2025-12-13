import { useEffect, useRef } from 'react';
import { makeEcho } from '../reverb/echo';

export default function useReverbEcho({
  effectiveKind,
  accessToken,
  roomId,
  onMessage,
  onTyping,
}) {
  const echoRef = useRef(null);
  const currentRoomRef = useRef(null);

  useEffect(() => {
    if (effectiveKind !== 'reverb') {
      if (echoRef.current) {
        try {
          if (currentRoomRef.current) {
            echoRef.current.leave(`room.${currentRoomRef.current}`);
            echoRef.current.leave(`presence.room.${currentRoomRef.current}`);
          }
          echoRef.current.disconnect();
        } catch {}
        echoRef.current = null;
        currentRoomRef.current = null;
      }
      return;
    }

    if (!accessToken) return;
    if (!echoRef.current) {
      const echo = makeEcho(accessToken);
      if (!echo) return;
      echoRef.current = echo;
    }

    // اگر roomId عوض شد، از قبلی leave و به جدید join
    if (roomId && currentRoomRef.current !== roomId) {
      try {
        if (currentRoomRef.current) {
          echoRef.current.leave(`room.${currentRoomRef.current}`);
          echoRef.current.leave(`presence.room.${currentRoomRef.current}`);
        }

        // Private channel پیام‌ها
        echoRef.current
          .channel(`room.${roomId}`)
          .listen('.chat.message', (e) => {
            // console.log('[Echo] chat.message', e);
            onMessage?.(e);
          });

        // Presence channel برای here/joining/leaving/typing
        echoRef.current
          .join(`presence.room.${roomId}`)
          .here((members) => {
            console.log('[Echo] here', members);
          })
          .joining((m) => console.log('[Echo] joining', m))
          .leaving((m) => console.log('[Echo] leaving', m))
          .listen('.typing.indicator', (e) => {
            // console.log('[Echo] typing', e);
            onTyping?.(e);
          });

        currentRoomRef.current = roomId;
      } catch (err) {
        console.warn('[Echo] subscribe error', err);
      }
    }

    return () => {
      // اختیاری: روی آن‌مونت کلی leave و disconnect
    };
  }, [effectiveKind, accessToken, roomId, onMessage, onTyping]);

  return echoRef;
}
