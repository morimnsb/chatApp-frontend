// src/features/chat/hooks/useGlobalNotify.js
import { useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { updateMessages } from "@/features/chat/state/messageActions";

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const toStr = (v) => (v == null ? "" : String(v));

function pickMessage(payload) {
  // ✅ support multiple shapes
  return payload?.message || payload?.payload?.message || payload?.data?.message || payload;
}

function pickRoomId(payload, msg) {
  return toNum(
    payload?.room_id ??
      payload?.roomId ??
      msg?.room_id ??
      msg?.roomId ??
      msg?.chat_room_id
  );
}

function pickSender(payload, msg) {
  // old shapes: payload.from_user, msg.user, msg.sender
  const fromUser = payload?.from_user || msg?.user || msg?.sender || payload?.user || null;

  const fromId = toNum(
    fromUser?.id ??
      msg?.user_id ??
      msg?.sender_id ??
      payload?.user_id ??
      payload?.sender_id
  );

  const fromName =
    toStr(fromUser?.name) ||
    toStr(fromUser?.first_name) ||
    toStr(fromUser?.email) ||
    toStr(msg?.sender_name) ||
    toStr(payload?.sender_name) ||
    (fromId ? `User ${fromId}` : "New message");

  return { fromUser: fromUser || (fromId ? { id: fromId, name: fromName } : null), fromId, fromName };
}

function pickText(payload, msg) {
  return (
    toStr(payload?.text) ||
    toStr(msg?.content) ||
    toStr(msg?.text) ||
    toStr(payload?.preview) ||
    toStr(msg?.preview) ||
    "New message"
  );
}

function pickCreatedAt(payload, msg) {
  return (
    payload?.created_at ||
    msg?.created_at ||
    msg?.createdAt ||
    payload?.ts ||
    msg?.ts ||
    new Date().toISOString()
  );
}

function pickMessageId(payload, msg) {
  return (
    msg?.id ||
    payload?.message_id ||
    payload?.id ||
    null
  );
}

export function useGlobalNotify({ selectedRoom }) {
  const dispatch = useDispatch();

  const notifyAudioRef = useRef(null);
  const lastAtRef = useRef(0);
  const seenRef = useRef(new Set()); // ✅ dedupe per messageId

  useEffect(() => {
    try {
      notifyAudioRef.current = new Audio("/sounds/incoming.mp3");
    } catch {
      notifyAudioRef.current = null;
    }
  }, []);

  const showDesktop = useCallback((title, body) => {
    try {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      if (!document.hidden) return;
      new Notification(title || "New message", { body: body || "" });
    } catch {}
  }, []);

  return useCallback(
    (payload) => {
      if (!payload || typeof payload !== "object") return;

      // ✅ support events:
      // - chat:notify (server sends {type:'notify', room_id, message, raw})
      // - chat:message (optional, if you ever send user-level messages)
      // - legacy user channel shapes
      const msg = pickMessage(payload);

      const roomId = pickRoomId(payload, msg);
      if (!roomId) return;

      const isActiveRoom = toNum(selectedRoom) === roomId;

      const { fromUser, fromId, fromName } = pickSender(payload, msg);
      const text = pickText(payload, msg);
      const createdAt = pickCreatedAt(payload, msg);

      const mid = pickMessageId(payload, msg);
      const now = Date.now();

      // ✅ dedupe key (if mid missing, use a short signature)
      const dedupeKey = mid ? `m:${roomId}:${mid}` : `t:${roomId}:${fromId}:${createdAt}:${text.slice(0, 40)}`;

      if (seenRef.current.has(dedupeKey)) return;
      seenRef.current.add(dedupeKey);

      // keep set small
      if (seenRef.current.size > 500) {
        const arr = Array.from(seenRef.current);
        seenRef.current = new Set(arr.slice(-250));
      }

      // ✅ toast فقط وقتی روم فعال نیست + throttle
      if (!isActiveRoom && now - lastAtRef.current > 900) {
        lastAtRef.current = now;

        toast.info(`${fromName}: ${text}`, {
          toastId: `notif-${dedupeKey}`,
        });

        notifyAudioRef.current?.play?.().catch(() => {});
        showDesktop(fromName, text);
      }

      // ✅ redux update (unread handled via meta)
      dispatch(
        updateMessages({
          type: payload?.type || "notify",
          room_id: roomId,
          roomId,
          message: {
            id: mid || `notif-${now}`,
            room_id: roomId,
            chat_room_id: roomId,
            user_id: msg?.user_id || msg?.sender_id || fromId || null,
            sender_id: msg?.sender_id || msg?.user_id || fromId || null,
            sender_name: msg?.sender_name || fromName,
            content: msg?.content || text,
            created_at: msg?.created_at || createdAt,
            user: msg?.user || fromUser || null,
          },
          meta: { via: "global-notif", unread: !isActiveRoom },
        })
      );
    },
    [dispatch, selectedRoom, showDesktop]
  );
}
