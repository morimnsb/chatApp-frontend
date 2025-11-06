// src/hooks/useEnsurePrivateRoom.js
import { useCallback } from 'react';

export default function useEnsurePrivateRoom({ endpoints, accessToken }) {
  return useCallback(
    async (toUserId, content = '') => {
      if (!endpoints?.firstMessage) {
        throw new Error('firstMessage endpoint is not defined');
      }
      const resp = await fetch(endpoints.firstMessage, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to_user_id: Number(toUserId), content }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok)
        throw new Error(data.error || data.message || `HTTP ${resp.status}`);
      return data.room_id;
    },
    [endpoints, accessToken],
  );
}
