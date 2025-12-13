// src/hooks/useUserEvents.js
import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { getOrCreateEcho } from '@/reverb/echo';
import { updateMessages } from '@/actions/messageActions';
import { toast } from 'react-toastify';

/**
 * این هوک:
 *  - اگر backend = reverb و توکن و userId موجود باشد:
 *      * به کانال شخصی user.{id} وصل می‌شود
 *      * به eventهای بک‌اند (مثل .direct.message) گوش می‌دهد
 *  - هیچ WebSocket جدیدی نمی‌سازد، فقط از Echo singleton استفاده می‌کند
 */
export default function useUserEvents({
  effectiveKind,
  accessToken,
  currentUserId,
}) {
  const dispatch = useDispatch();
  const channelRef = useRef(null);

  const IS_REVERB = String(effectiveKind || '').toLowerCase() === 'reverb';
  const hasToken = !!accessToken;
  const hasUserId = !!currentUserId;

  useEffect(() => {
    console.log('[UserEvents] effect', {
      effectiveKind,
      hasToken,
      currentUserId,
    });

    // اگر شرایط کافی نیست، لیسنر رو جمع کن
    if (!IS_REVERB || !hasToken || !hasUserId) {
      if (channelRef.current) {
        try {
          channelRef.current.stopListening('.direct.message');
        } catch {}
        channelRef.current = null;
      }
      return;
    }

    const echo = getOrCreateEcho(accessToken);
    if (!echo) return;

    const channelName = `user.${currentUserId}`;
    console.log('[UserEvents] subscribing to', channelName);

    const channel = echo
      .private(channelName)
      .listen('.direct.message', (payload) => {
        console.log('[UserEvents] direct.message', payload);

        // فرض می‌کنیم payload = خروجی broadcastWith در DirectMessageSent
        // اینجا دو کار می‌کنیم:
        // 1) پیام را می‌فرستیم تو Redux
        // 2) یک toast کوچک برای اطلاع
        try {
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
        } catch (e) {
          console.warn('[UserEvents] updateMessages failed', e);
        }

        try {
          toast.info(
            payload.sender_name
              ? `${payload.sender_name}: ${payload.content}`
              : payload.content,
          );
        } catch {}
      });

    channelRef.current = channel;

    return () => {
      console.log('[UserEvents] cleanup', channelName);
      try {
        channel.stopListening('.direct.message');
      } catch {}
      channelRef.current = null;
    };
  }, [
    IS_REVERB,
    hasToken,
    hasUserId,
    effectiveKind,
    accessToken,
    currentUserId,
  ]);
}
