// src/hooks/chat/useGlobalNotify.js
import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useDispatch } from 'react-redux';

// ✅ legacy action
import { updateMessages } from '@/actions/messageActions';

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

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

  return useCallback(
    (payload) => {
      if (!payload || typeof payload !== 'object') return;

      // payload از user channel میاد
      const roomId = toNum(payload.room_id ?? payload.roomId);
      if (!roomId) return;

      const isActiveRoom = toNum(selectedRoom) === roomId;

      const msg = payload.message || {};
      const fromUser = payload.from_user || msg.user || msg.sender || {};

      const fromId = toNum(fromUser.id ?? msg.user_id ?? msg.sender_id);
      const fromName =
        fromUser.name ||
        fromUser.first_name ||
        fromUser.email ||
        msg.sender_name ||
        payload.sender_name ||
        (fromId ? `User ${fromId}` : 'New message');

      const text = String(
        payload.text ??
          msg.content ??
          payload.preview ??
          msg.preview ??
          'New message'
      );

      const createdAt = payload.created_at || msg.created_at || new Date().toISOString();
      const now = Date.now();

      // toast فقط وقتی روم فعال نیست
      if (!isActiveRoom && now - lastAtRef.current > 900) {
        lastAtRef.current = now;
        toast.info(`${fromName}: ${text}`, {
          toastId: `notif-${msg.id || payload.message_id || now}`,
        });
        notifyAudioRef.current?.play().catch(() => {});
        showDesktop(fromName, text);
      }

      // ✅ مهم: فقط legacy reducer آپدیت شود
      dispatch(
        updateMessages({
          type: 'notify',        // legacy reducer معمولاً type رو می‌خونه
          room_id: roomId,
          roomId,
          message: {
            id: msg.id || payload.message_id || `notif-${now}`,
            room_id: roomId,
            chat_room_id: roomId,
            user_id: msg.user_id || msg.sender_id || fromId || null,
            sender_id: msg.sender_id || msg.user_id || fromId || null,
            sender_name: msg.sender_name || fromName,
            content: msg.content || text,
            created_at: msg.created_at || createdAt,
            user: msg.user || fromUser || null,
          },
          meta: { via: 'global-notif', unread: !isActiveRoom },
        })
      );
    },
    [dispatch, selectedRoom, showDesktop]
  );
}
