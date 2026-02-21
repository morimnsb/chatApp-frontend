//chatApp-frontend\src\features\chat\hooks\useGlobalNotify.ts
import { useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { updateMessages } from "@/features/chat/state/messageActions";
import { useAppDispatch } from "@/app/store/hooks";

type AnyRecord = Record<string, any>;
type Id = string | number;

type GlobalNotifyArgs = {
  selectedRoom?: Id | null;
};

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const toStr = (v: unknown): string => (v == null ? "" : String(v));

function pickMessage(payload: AnyRecord): AnyRecord | null {
  // ✅ support multiple shapes
  return (payload?.message ||
    payload?.payload?.message ||
    payload?.data?.message ||
    payload) as AnyRecord | null;
}

function pickRoomId(payload: AnyRecord, msg: AnyRecord | null): number {
  return toNum(
    payload?.room_id ??
      payload?.roomId ??
      msg?.room_id ??
      msg?.roomId ??
      msg?.chat_room_id
  );
}

function pickSender(payload: AnyRecord, msg: AnyRecord | null) {
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

  return {
    fromUser: (fromUser || (fromId ? { id: fromId, name: fromName } : null)) as AnyRecord | null,
    fromId,
    fromName,
  };
}

function pickText(payload: AnyRecord, msg: AnyRecord | null): string {
  return (
    toStr(payload?.text) ||
    toStr(msg?.content) ||
    toStr(msg?.text) ||
    toStr(payload?.preview) ||
    toStr(msg?.preview) ||
    "New message"
  );
}

function pickCreatedAt(payload: AnyRecord, msg: AnyRecord | null): string {
  return (
    toStr(payload?.created_at) ||
    toStr(msg?.created_at) ||
    toStr(msg?.createdAt) ||
    toStr(payload?.ts) ||
    toStr(msg?.ts) ||
    new Date().toISOString()
  );
}

function pickMessageId(payload: AnyRecord, msg: AnyRecord | null): Id | null {
  return (msg?.id ?? payload?.message_id ?? payload?.id ?? null) as Id | null;
}

export function useGlobalNotify({ selectedRoom }: GlobalNotifyArgs) {
  const dispatch = useAppDispatch();

  const notifyAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastAtRef = useRef<number>(0);

  // ✅ dedupe per messageId
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      notifyAudioRef.current = new Audio("/sounds/incoming.mp3");
    } catch {
      notifyAudioRef.current = null;
    }
  }, []);

  const showDesktop = useCallback((title?: string, body?: string) => {
    try {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      if (!document.hidden) return;

      new Notification(title || "New message", { body: body || "" });
    } catch {
      // ignore
    }
  }, []);

  return useCallback(
    (payloadRaw: unknown) => {
      if (!payloadRaw || typeof payloadRaw !== "object") return;
      const payload = payloadRaw as AnyRecord;

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
      const dedupeKey = mid
        ? `m:${roomId}:${String(mid)}`
        : `t:${roomId}:${fromId}:${createdAt}:${text.slice(0, 40)}`;

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