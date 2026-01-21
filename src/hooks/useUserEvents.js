// src/hooks/useUserEvents.js
import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { getOrCreateEcho } from '@/reverb/echo';
import { updateMessages } from '@/actions/messageActions';
import { toast } from 'react-toastify';

export default function useUserEvents({ effectiveKind, accessToken, currentUserId }) {
  const dispatch = useDispatch();

  const subRef = useRef({
    echo: null,
    channelName: null,
    isBound: false,
  });

  useEffect(() => {
    const kind = String(effectiveKind || '').toLowerCase();
    const isReverb = kind === 'reverb';

    const hasToken = Boolean(accessToken);
    const hasUserId = Boolean(currentUserId);

    console.log('[UserEvents] effect', { kind, isReverb, hasToken, currentUserId });

    // --- helper: cleanup فعلی ---
    const cleanup = () => {
      const prev = subRef.current;
      if (!prev.echo || !prev.channelName) {
        subRef.current = { echo: null, channelName: null, isBound: false };
        return;
      }

      try {
        // اگر listener بسته شده بود، stopListening صدا بزن
        if (prev.isBound) {
          prev.echo.private(prev.channelName).stopListening('.direct.message');
        }
      } catch {}

      try {
        // ✅ درست: کانال پایه را بده، خود Echo private/presence را هم ترک می‌کند
        prev.echo.leave(prev.channelName);
      } catch {}

      subRef.current = { echo: null, channelName: null, isBound: false };
    };

    // اگر شرایط فراهم نیست، هر چیزی بوده ببند
    if (!isReverb || !hasToken || !hasUserId) {
      cleanup();
      return;
    }

    const echo = getOrCreateEcho(accessToken);
    if (!echo) {
      cleanup();
      return;
    }

    const channelName = `user.${currentUserId}`;

    // اگر قبلاً همین کانال با همین echo فعال است، دوباره bind نکن
    const prev = subRef.current;
    if (prev.echo === echo && prev.channelName === channelName && prev.isBound) {
      return;
    }

    // اگر قبلی وجود داشته، اول تمیز ببند
    cleanup();

    console.log('[UserEvents] subscribing to', channelName);

    // bind
    echo
      .private(channelName)
      .listen('.direct.message', (payload) => {
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
          })
        );

        toast.info(
          payload?.sender_name ? `${payload.sender_name}: ${payload.content}` : payload?.content
        );
      });

    subRef.current = { echo, channelName, isBound: true };

    return cleanup;
  }, [dispatch, effectiveKind, accessToken, currentUserId]);
}
