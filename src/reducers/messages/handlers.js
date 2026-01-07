import {
  isObj,
  getUserId,
  getPartnerIdFromConv,
  getRoomIdFromConv,
  getMsgIds,
  makeDefaultConversation,
} from './helpers';

/* ---------------- config ---------------- */

const MAX_HISTORY = 200;

/* ---------------- helpers ---------------- */

// اگر دوست داری اینو ببری helpers.js بهتره، ولی فعلاً همینجا هم OK هست
export const makeDefaultGroupConversation = (roomId, roomObj = {}) => ({
  id: roomId,
  roomId,
  name: roomObj.name || roomObj.title || roomObj.room_name || `Group #${roomId}`,
  last_message: null,
  last_message_at: null,
  unread_count: 0,
  messages: [],
});

const getRoomId = (packet, msg) =>
  Number(
    packet?.room_id ||
      packet?.roomId ||
      msg?.chat_room_id ||
      msg?.room_id ||
      msg?.roomId ||
      msg?.room?.id ||
      packet?.room?.id ||
      0,
  ) || null;

const getMsgId = (msg, roomId) => {
  const id = msg?.id ?? msg?.message_id ?? msg?.uuid ?? null;
  if (id != null) return id;
  const ts = msg?.created_at || msg?.timestamp || Date.now();
  return `r${roomId}-${ts}`;
};

const isGroupPacket = (packet, msg) =>
  !!(
    packet?.is_group ??
    msg?.is_group ??
    msg?.isGroup ??
    packet?.room?.is_group ??
    msg?.room?.is_group
  );

const shouldUnread = (d, packet, roomId) => {
  if (packet?.meta?.unread != null) return !!packet.meta.unread; // explicit
  return Number(d.selectedRoom) !== Number(roomId); // active room => no unread
};

const pushDedupLimit = (arr, msg, msgId, limit = MAX_HISTORY) => {
  if (!Array.isArray(arr)) return [msg];

  const last = arr[arr.length - 1];
  const lastId = last?.id ?? last?.message_id;

  if (lastId === msgId) return arr;
  if (arr.some((m) => (m?.id ?? m?.message_id) === msgId)) return arr;

  arr.push(msg);

  if (arr.length > limit) arr.splice(0, arr.length - limit);

  return arr;
};

/* ---------------- handlers ---------------- */

export const h = {
  setCurrentUser(d, p) {
    if (!isObj(p)) {
      d.errorStates.users = 'Invalid user data';
      return;
    }
    d.currentUser = p;
  },

  setUsers(d, p) {
    if (!Array.isArray(p)) {
      d.errorStates.users = 'Invalid users data';
      return;
    }
    d.users = p.reduce((acc, u) => {
      if (isObj(u) && u.id != null) acc[u.id] = u;
      return acc;
    }, {});
  },

  setIndividualMessages(d, p) {
    if (isObj(p)) {
      d.individualMessages = { ...d.individualMessages, ...p };
      d.errorStates.messages = null;
      return;
    }

    if (!Array.isArray(p)) {
      d.errorStates.messages = 'Invalid conversations data';
      return;
    }

    const map = p.reduce((acc, conv) => {
      if (!isObj(conv)) return acc;

      const partnerId = getPartnerIdFromConv(conv);
      const roomId = getRoomIdFromConv(conv);
      if (!partnerId || !roomId) return acc;

      const userObj = d.users?.[partnerId] || conv.user || {};
      const base = makeDefaultConversation(partnerId, userObj, roomId);

      acc[partnerId] = { ...base, ...conv, partnerId, roomId };
      return acc;
    }, {});

    d.individualMessages = { ...d.individualMessages, ...map };
    d.errorStates.messages = null;
  },

  setGroupMessages(d, p) {
    if (isObj(p)) {
      d.groupMessages = { ...d.groupMessages, ...p };
      d.errorStates.messages = null;
      return;
    }

    if (!Array.isArray(p)) {
      d.errorStates.messages = 'Invalid group messages data';
      return;
    }

    d.groupMessages = {
      ...d.groupMessages,
      ...p.reduce((acc, g) => {
        const id = g?.id ?? g?.roomId ?? g?.room_id;
        if (isObj(g) && id != null) acc[id] = g;
        return acc;
      }, {}),
    };
    d.errorStates.messages = null;
  },

  selectRoom(d, p) {
    d.selectedRoom = p ?? null;
  },

  // ✅ FINAL: DM + GROUP + DEDUPE + SMART UNREAD + HISTORY LIMIT
  updateMessages(d, p) {
    const packet = p || {};
    const msg = isObj(packet.message) ? packet.message : null;

    if (!msg) {
      d.errorStates.messages = 'Missing message payload';
      return;
    }

    const me = getUserId(d.currentUser);
    if (!me) {
      d.errorStates.messages = 'Current user not set';
      return;
    }

    const roomId = getRoomId(packet, msg);
    if (!roomId) {
      d.errorStates.messages = 'Missing roomId';
      return;
    }

    const createdAt = msg.created_at || msg.timestamp || new Date().toISOString();
    const msgId = getMsgId(msg, roomId);
    const unread = shouldUnread(d, packet, roomId);

    // ---------- GROUP ----------
    if (isGroupPacket(packet, msg)) {
      const existing = d.groupMessages[roomId];
      const roomObj = packet.room || msg.room || existing || {};
      const conv = existing || makeDefaultGroupConversation(roomId, roomObj);

      conv.name =
        conv.name ||
        roomObj.name ||
        roomObj.title ||
        roomObj.room_name ||
        `Group #${roomId}`;

      conv.last_message = msg;
      conv.last_message_at = createdAt;

      if (!Array.isArray(conv.messages)) conv.messages = [];
      pushDedupLimit(conv.messages, { ...msg, id: msgId }, msgId);

      if (unread) conv.unread_count = (conv.unread_count || 0) + 1;

      d.groupMessages[roomId] = conv;
      d.errorStates.messages = null;
      return;
    }

    // ---------- DM ----------
    const { senderId, receiverId } = getMsgIds(msg);
    if (senderId == null || receiverId == null) {
      d.errorStates.messages = 'Invalid message schema (sender/receiver)';
      return;
    }

    const partnerId = Number(me) === Number(senderId) ? receiverId : senderId;

    const existing = d.individualMessages[partnerId];
    const userObj = d.users?.[partnerId] || packet.from_user || msg.from_user || {};
    const conv = existing || makeDefaultConversation(partnerId, userObj, roomId);

    if (!conv.roomId) conv.roomId = roomId;

    conv.last_message = msg;
    conv.last_message_at = createdAt;

    if (!Array.isArray(conv.messages)) conv.messages = [];
    pushDedupLimit(conv.messages, { ...msg, id: msgId }, msgId);

    const fromOther = Number(senderId) !== Number(me);
    if (fromOther && unread) conv.unread_count = (conv.unread_count || 0) + 1;

    d.individualMessages[partnerId] = conv;
    d.errorStates.messages = null;
  },

  updateStatus(d, p) {
    const { senderId, status } = p || {};
    if (senderId != null && d.individualMessages[senderId]) {
      d.individualMessages[senderId].is_online = !!status;
    }
  },

  clearUnreadCount(d, p) {
    const partnerId = p;
    if (partnerId != null && d.individualMessages[partnerId]) {
      d.individualMessages[partnerId].unread_count = 0;
    }
  },

  setLoading(d, p) {
    const { type, status } = p || {};
    if (type) d.loadingStates[type] = !!status;
  },

  setError(d, p) {
    const { type, message } = p || {};
    d.errorStates[type || 'messages'] = message || 'Unknown error';
  },

  setTyping(d, p) {
    const { userId, isTyping } = p || {};
    if (userId != null) d.typingIndicators[userId] = !!isTyping;
  },

  resetTyping(d, p) {
    const { userId } = p || {};
    if (userId != null) delete d.typingIndicators[userId];
  },

  deleteMessage(d, p) {
    const { messageId, partnerId } = p || {};
    const conv = partnerId != null ? d.individualMessages[partnerId] : null;
    if (conv && Array.isArray(conv.messages)) {
      conv.messages = conv.messages.filter(
        (m) => (m?.id ?? m?.message_id) !== messageId,
      );
    }
  },
};
