// src/hooks/chat/usePresence.js
import { useState } from 'react';
import useGlobalWebSocket from '@/hooks/useGlobalWebSocket';

export function usePresence({ backendKind, token, currentUserId, onGlobalNotification }) {
  const [onlineUsers, setOnlineUsers] = useState([]);

  useGlobalWebSocket({
    backendKind,
    token,
    currentUserId,
    onOnlineUsersChange: (next) => {
      setOnlineUsers((prev) => (typeof next === 'function' ? next(prev) : next));
    },
    enableGlobalNotifications: true,
    handleGlobalNotification: onGlobalNotification,
  });

  return { onlineUsers };
}
