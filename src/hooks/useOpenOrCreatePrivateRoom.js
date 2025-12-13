// src/hooks/useOpenOrCreatePrivateRoom.js
import { useState, useCallback } from 'react';

export default function useOpenOrCreatePrivateRoom({
  endpoints,
  effectiveKind, // فعلاً استفاده نمی‌کنیم، ولی آینده شاید برای Reverb استفاده کنیم
  accessToken,
  handleSelectChat,
}) {
  const [pending, setPending] = useState(false);
  const [lastError, setLastError] = useState(null);

  const openOrCreate = useCallback(
    async (recipientId, content = '') => {
      if (!recipientId) {
        console.warn('[DM] no recipientId provided');
        return;
      }
      if (!accessToken) {
        console.warn('[DM] no accessToken, aborting make-contact');
        return;
      }
      if (!endpoints?.makeContact) {
        console.warn('[DM] endpoints.makeContact is missing', endpoints);
        return;
      }

      setPending(true);
      setLastError(null);

      try {
        const url = endpoints.makeContact;
        console.log('[DM] make-contact →', url, {
          recipientId,
          contentPreview: content.slice(0, 50),
        });

        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            recipient_id: recipientId,
            content,
          }),
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          console.error('[DM] FAIL', resp.status, data);
          throw new Error(
            data?.message || `Make-contact failed with status ${resp.status}`,
          );
        }

        console.log('[DM] RESPONSE make-contact', resp.status, data);

        const room = data.room;
        if (!room) {
          throw new Error('No room returned from make-contact');
        }

        // 👇 روم انتخاب می‌شود
        handleSelectChat(room.id, recipientId);
        return data;
      } catch (err) {
        console.error('[DM] ERROR', err);
        setLastError(err);
        return null;
      } finally {
        setPending(false);
      }
    },
    [endpoints, accessToken, handleSelectChat],
  );

  return { openOrCreate, pending, lastError };
}
