// src/hooks/useOpenOrCreatePrivateRoom.js
import { useCallback } from 'react';
import { toast } from 'react-toastify';
import useGenerateRoomId from './useGenerateRoomId'; // همون XOR قبلی
import { useSelector } from 'react-redux';

export default function useOpenOrCreatePrivateRoom({
  endpoints, // از buildEndpoints
  effectiveKind, // 'laravel' | 'reverb' | 'django'
  accessToken,
  handleSelectChat, // (roomId, receiverId)
}) {
  const currentUser = useSelector(
    (s) => s.auth?.currentUser ?? s.message?.currentUser,
  );

  const generateRoomId = useGenerateRoomId(currentUser, handleSelectChat);

  const openOrCreate = useCallback(
    async (toUserId, firstText = '') => {
      // اگر جنگوست → روش کلاینتی
      if (effectiveKind === 'django') {
        generateRoomId(toUserId);
        return;
      }

      // Laravel/Reverb: بک‌اند روم را می‌سازد/برمی‌گرداند
      try {
        const resp = await fetch(endpoints.firstMessage, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            to_user_id: toUserId,
            text: firstText || '',
          }),
        });

        if (!resp.ok) {
          const e = await resp.json().catch(() => ({}));
          throw new Error(e?.error || `HTTP ${resp.status}`);
        }

        const data = await resp.json().catch(() => ({}));
        const roomId = data?.room_id;
        if (!roomId) throw new Error('Missing room_id in response');

        handleSelectChat(roomId, toUserId);
      } catch (err) {
        // اگر 404 بود یعنی هنوز route/اکشن بک‌اند را نساختی
        if (String(err.message || '').includes('404')) {
          toast.error('first-message route not found (backend)');
        } else {
          toast.error(err.message || 'Failed to open/create room');
        }
      }
    },
    [
      effectiveKind,
      endpoints.firstMessage,
      accessToken,
      handleSelectChat,
      generateRoomId,
    ],
  );

  return openOrCreate;
}
