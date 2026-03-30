// chatApp-frontend/src/features/chat/utils/wsRouter.js
import messageActionTypes from "@/features/chat/state/messageActionTypes";
const _seenMsgIds = new Set();
const SEEN_MAX = 2000;

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pickRoomId(payload) {
  return (
    toInt(payload?.room_id) ??
    toInt(payload?.roomId) ??
    toInt(payload?.chat_room_id) ??
    toInt(payload?.chatRoomId) ??
    toInt(payload?.message?.chat_room_id) ??
    toInt(payload?.message?.room_id) ??
    toInt(payload?.message?.roomId) ??
    toInt(payload?.message?.chatRoomId) ??
    null
  );
}

function pickUserId(payload) {
  return (
    toInt(payload?.user_id) ??
    toInt(payload?.userId) ??
    toInt(payload?.sender_id) ??
    toInt(payload?.senderId) ??
    toInt(payload?.message?.user_id) ??
    toInt(payload?.message?.userId) ??
    toInt(payload?.message?.sender_id) ??
    toInt(payload?.message?.senderId) ??
    null
  );
}

function normalizeMessage(payload) {
  const roomId = pickRoomId(payload);
  const m = payload?.message && typeof payload.message === "object" ? payload.message : payload;

  const id = toInt(m?.id) ?? null;

  const userId =
    toInt(m?.user_id) ??
    toInt(m?.userId) ??
    toInt(m?.sender_id) ??
    toInt(m?.senderId) ??
    null;

  const content =
    (typeof m?.content === "string" ? m.content : null) ??
    (typeof m?.text === "string" ? m.text : null) ??
    null;

  const kind = (typeof m?.kind === "string" ? m.kind : null) ?? "text";
  const createdAt = m?.created_at ?? m?.createdAt ?? null;
  const updatedAt = m?.updated_at ?? m?.updatedAt ?? null;

  const user =
    m?.user && typeof m.user === "object"
      ? {
          id: toInt(m.user.id) ?? null,
          name: m.user.name ?? null,
          email: m.user.email ?? null,
        }
      : null;

  return {
    id,
    room_id: roomId,
    roomId,
    chat_room_id: roomId,
    chatRoomId: roomId,

    user_id: userId,
    userId,
    sender_id: userId,
    senderId: userId,

    content,
    text: content,
    kind,

    created_at: createdAt,
    createdAt,
    updated_at: updatedAt,
    updatedAt,

    user,
    raw: payload,
  };
}

function isTypingPayload(payload, sourceEventName = null) {
  if (!payload || typeof payload !== "object") return false;
  if (payload.type === "typing_indicator") return true;
  if (payload.type === "typing") return true;

  const ev = String(sourceEventName || "").trim().toLowerCase();
  if (ev === "typing" || ev === ".typing") return true;
  if (ev === "typing_indicator" || ev === ".typing_indicator") return true;

  return typeof payload.isTyping === "boolean" && Boolean(payload.room_id || payload.roomId);
}

function isNotifyPayload(payload, sourceEventName = null) {
  const ev = String(sourceEventName || "").trim().toLowerCase();

  if (payload?.type === "notify") return true;
  if (payload?.type === "chat:notify") return true;

  if (ev === "chat:notify" || ev === ".chat:notify") return true;
  if (ev === "direct.message" || ev === ".direct.message") return true;

  return false;
}

function isMessageEventName(sourceEventName = null) {
  const ev = String(sourceEventName || "").trim().toLowerCase();
  return (
    ev === "chat:message" ||
    ev === ".chat:message" ||
    ev === "chatmessagecreated".toLowerCase() ||
    ev === ".chatmessagecreated".toLowerCase()
  );
}

function markSeen(id) {
  if (!id) return;
  _seenMsgIds.add(id);

  if (_seenMsgIds.size > SEEN_MAX) {
    const it = _seenMsgIds.values();
    for (let i = 0; i < 300; i++) {
      const n = it.next();
      if (n.done) break;
      _seenMsgIds.delete(n.value);
    }
  }
}

function alreadySeen(id) {
  if (!id) return false;
  return _seenMsgIds.has(id);
}

export function routeRealtimePayload(payload, ctx) {
  const dispatch = ctx?.dispatch;
  const selectedRoomId = toInt(ctx?.selectedRoomId);
  const currentUserId = toInt(ctx?.currentUserId);
  const sourceEventName = ctx?.sourceEventName ?? ctx?.eventName ?? null;

  if (!payload || typeof payload !== "object") return;

  // 1) typing
if (isTypingPayload(payload, sourceEventName)) {
  const rid = pickRoomId(payload);
  const uid = pickUserId(payload);

  if (!rid || !uid) return;

  // self typing را route نکن
  if (currentUserId && uid === currentUserId) return;

  dispatch?.({
    type: messageActionTypes.SET_TYPING_INDICATOR,
    payload: {
      roomId: rid,
      room_id: rid,
      userId: uid,
      user_id: uid,
      isTyping: Boolean(payload?.isTyping),
      at: payload?.at ?? Date.now(),
    },
  });

  return;
}

  // 2) normalize message
  const msg = normalizeMessage(payload);
  const rid = toInt(msg.roomId);
  if (!rid) return;

  // 3) classify
  const notifyByEvent = isNotifyPayload(payload, sourceEventName);
  const messageByEvent = isMessageEventName(sourceEventName);
  const isNotify = messageByEvent ? false : notifyByEvent;

  // 4) active-room notify promotion
  if (isNotify && selectedRoomId && rid === selectedRoomId) {
    const hasRealMessage = Boolean(msg?.content || msg?.text) || Boolean(msg?.id);

    if (hasRealMessage) {
      if (msg.id && alreadySeen(msg.id)) {
        return;
      }

      markSeen(msg.id);

      dispatch?.({
        type: "chat/wsMessage",
        payload: {
          roomId: rid,
          message: msg,
          fromUserId: msg.userId,
          currentUserId,
          promotedFrom: "notify",
        },
      });
      return;
    }

    return;
  }

  // 5) dedupe
  if (msg.id && alreadySeen(msg.id)) {
    return;
  }

  markSeen(msg.id);

  // 6) notify path
  if (isNotify) {
    dispatch?.({
      type: "chat/wsNotify",
      payload: {
        roomId: rid,
        message: msg,
        fromUserId: msg.userId,
        currentUserId,
      },
    });
    return;
  }

  // 7) room message for inactive room => treat as notify
  if (selectedRoomId && rid !== selectedRoomId) {
    dispatch?.({
      type: "chat/wsNotify",
      payload: {
        roomId: rid,
        message: msg,
        fromUserId: msg.userId,
        currentUserId,
        reason: "room_message_for_inactive_room",
      },
    });
    return;
  }

  // 8) active room message
  dispatch?.({
    type: "chat/wsMessage",
    payload: {
      roomId: rid,
      message: msg,
      fromUserId: msg.userId,
      currentUserId,
    },
  });
}