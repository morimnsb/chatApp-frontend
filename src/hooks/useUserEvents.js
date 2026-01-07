// src/hooks/useUserEvents.js
import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { getOrCreateEcho } from '@/reverb/echo';
import { updateMessages } from '@/actions/messageActions';
import { toast } from 'react-toastify';

export default function useUserEvents({ effectiveKind, accessToken, currentUserId }) {
  const dispatch = useDispatch();
  const channelRef = useRef(null);

  const IS_REVERB = String(effectiveKind || '').toLowerCase() === 'reverb';

  useEffect(() => {
    const hasToken = !!accessToken;
    const hasUserId = !!currentUserId;

    console.log('[UserEvents] effect', { effectiveKind, hasToken, currentUserId });

    if (!IS_REVERB || !hasToken || !hasUserId) {
      channelRef.current = null;
      return;
    }

    const echo = getOrCreateEcho(accessToken);
    if (!echo) return;

    const channelName = `user.${currentUserId}`;
    console.log('[UserEvents] subscribing to', channelName);

    const channel = echo.private(channelName).listen('.direct.message', (payload) => {
      dispatch(
        updateMessages({
          type: 'message',
          message: {
            id: payload.id,
            room_id: payload.room_id,
            content: payload.content,
            sender_id: payload.sender_id,
            sender_name: payload.sender_name,
            created_at: payload.created_at,
            timestamp: payload.timestamp,
            read_receipt: payload.read_receipt,
          },
        }),
      );

      toast.info(
        payload.sender_name ? `${payload.sender_name}: ${payload.content}` : payload.content,
      );
    });

    channelRef.current = channel;

    return () => {
      try {
        channel.stopListening('.direct.message');
      } catch {}
      try {
        // ✅ کانال را کامل ترک کن
        echo.leave(`private-${channelName}`);
      } catch {}
      channelRef.current = null;
    };
  }, [IS_REVERB, effectiveKind, accessToken, currentUserId, dispatch]);
}
