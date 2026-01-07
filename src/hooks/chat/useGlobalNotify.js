// src/hooks/chat/useGlobalNotify.js
import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useDispatch } from 'react-redux';
import { updateMessages } from '@/actions/messageActions';

export function useGlobalNotify({ selectedRoom }) {
  const dispatch = useDispatch();
  const notifyAudioRef = useRef(null);
  const lastAtRef = useRef(0);

  useEffect(() => {
    try {
      notifyAudioRef.current = new Audio('/sounds/incoming.mp3');
    } catch {
      notifyAudioRef.current = null;
    }
  }, []);

  const showDesktop = useCallback((title, body) => {
    try {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      if (!document.hidden) return;
      new Notification(title || 'New message', { body: body || '' });
    } catch {}
  }, []);

  return useCallback((packet) => {
    if (!packet || packet.type !== 'notify_message') return;

    const roomId = Number(packet.room_id || 0);
    if (!roomId) return;

    const isActiveRoom = Number(selectedRoom) === roomId;

    const fromId = Number(packet.from_user?.id || 0);
    const fromName =
      packet.from_user?.name ||
      packet.from_user?.first_name ||
      packet.from_user?.email ||
      `User ${fromId || ''}`;

    const text = String(packet.text || packet.message?.content || 'New message');

    const now = Date.now();
    if (!isActiveRoom && now - lastAtRef.current > 900) {
      lastAtRef.current = now;
      toast.info(`${fromName}: ${text}`, { toastId: `notif-${packet.message_id || now}` });
      notifyAudioRef.current?.play().catch(() => {});
      showDesktop(fromName, text);
    }

    dispatch(updateMessages({
      type: 'message',
      room_id: roomId,
      message: {
        id: packet.message_id || `notif-${now}`,
        room_id: roomId,
        sender_id: fromId,
        sender_name: fromName,
        content: text,
        created_at: packet.created_at || new Date().toISOString(),
      },
      meta: { via: 'global-notif', unread: !isActiveRoom },
    }));
  }, [dispatch, selectedRoom, showDesktop]);
}
