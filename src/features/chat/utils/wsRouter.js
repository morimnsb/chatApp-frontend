// chatApp-frontend/src/features/chat/utils/wsRouter.js

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

  const user =
    m?.user && typeof m.user === "object"
      ? { id: toInt(m.user.id) ?? null, name: m.user.name ?? null, email: m.user.email ?? null }
      : null;

  return {
    id,
    room_id: roomId,
    roomId,
    user_id: userId,
    userId,
    sender_id: userId,
    senderId: userId,
    content,
    text: content,
    kind,
    created_at: createdAt,
    createdAt,
    user,
    raw: payload,
  };
}

function isTypingPayload(payload, sourceEventName = null) {
  if (!payload || typeof payload !== "object") return false;
  if (payload.type === "typing_indicator") return true;

  const ev = String(sourceEventName || "");
  if (ev === "typing" || ev === ".typing") return true;
  if (ev === "typing_indicator" || ev === ".typing_indicator") return true;

  return typeof payload.isTyping === "boolean" && (payload.room_id || payload.roomId);
}



function isNotifyPayload(payload, sourceEventName = null) {
  const ev = String(sourceEventName || "");
  if (payload?.type === "notify") return true;

  if (ev === "chat:notify" || ev === ".chat:notify") return true;
  if (ev === "direct.message" || ev === ".direct.message") return true;

  // fallback
  if (payload?.type === "chat:notify") return true;
  return false;
}

function isMessageEventName(sourceEventName = null) {
  const ev = String(sourceEventName || "");
  return (
    ev === "chat:message" ||
    ev === ".chat:message" ||
    ev === "ChatMessageCreated" ||
    ev === ".ChatMessageCreated"
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

  // ✅ allow ctx to override selectedRoomId/currentUserId (meta wins)
  const selectedRoomId = toInt(ctx?.selectedRoomId);
  const currentUserId = toInt(ctx?.currentUserId);

  const sourceEventName = ctx?.sourceEventName ?? ctx?.eventName ?? null;
  if (!payload || typeof payload !== "object") return;

  // 1) typing
  if (isTypingPayload(payload, sourceEventName)) {
    const rid = toInt(payload.room_id ?? payload.roomId);
    const uid = toInt(payload.user_id ?? payload.userId ?? payload.sender_id ?? payload.senderId);
    if (!rid || !uid) return;

    dispatch?.({
      type: "chat/wsTyping",
      payload: { roomId: rid, userId: uid, isTyping: Boolean(payload.isTyping), at: payload.at ?? Date.now() },
    });
    return;
  }

  // 2) normalize
  const msg = normalizeMessage(payload);
  const rid = toInt(msg.roomId);
  if (!rid) return;

  // 3) classify
  const notifyByEvent = isNotifyPayload(payload, sourceEventName);
  const messageByEvent = isMessageEventName(sourceEventName);

  const isNotify = messageByEvent ? false : notifyByEvent;

  // ✅ ignore notify for active room (THIS IS THE KEY)
  // ✅ ignore notify for active room (BUT promote to message if it contains a real message)
if (isNotify && selectedRoomId && rid === selectedRoomId) {
  const hasRealMessage =
    Boolean(msg?.content || msg?.text) || Boolean(msg?.id);

  if (hasRealMessage) {
    dispatch?.({
      type: "chat/wsMessage",
      payload: { roomId: rid, message: msg, fromUserId: msg.userId, currentUserId, promotedFrom: "notify" },
    });

    dispatch?.({
      type: "chat/wsDebug",
      payload: { kind: "notify_promoted_to_message", roomId: rid, eventName: sourceEventName, id: msg.id ?? null },
    });

    // ✅ IMPORTANT: mark seen after dispatch
    markSeen(msg.id);

    return;
  }

  dispatch?.({
    type: "chat/wsDebug",
    payload: { kind: "ignore_notify_active_room", roomId: rid, eventName: sourceEventName },
  });
  return;
}


  // 4) dedupe
  if (msg.id && alreadySeen(msg.id)) {
    dispatch?.({ type: "chat/wsDebug", payload: { kind: "dedupe_drop", id: msg.id, roomId: rid, eventName: sourceEventName } });
    return;
  }

  // ✅ mark seen ONLY after we decided not to ignore
  markSeen(msg.id);

  // 5) notify path
  if (isNotify) {
    dispatch?.({
      type: "chat/wsNotify",
      payload: { roomId: rid, message: msg, fromUserId: msg.userId, currentUserId },
    });
    return;
  }

  // 6) message path
  if (selectedRoomId && rid !== selectedRoomId) {
    dispatch?.({
      type: "chat/wsNotify",
      payload: { roomId: rid, message: msg, fromUserId: msg.userId, currentUserId, reason: "room_message_for_inactive_room" },
    });
    return;
  }

  dispatch?.({
    type: "chat/wsMessage",
    payload: { roomId: rid, message: msg, fromUserId: msg.userId, currentUserId },
  });
}
