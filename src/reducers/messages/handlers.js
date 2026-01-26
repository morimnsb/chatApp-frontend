// chatApp-frontend\src\reducers\messages\handlers.js
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

// ✅ NEW: برای schema جدید (Sanctum+Reverb) که DM پیام receiver_id ندارد
// partnerId را از روی roomId داخل state پیدا می‌کنیم.
const getPartnerIdFromRoom = (d, roomId, me) => {
  const rid = Number(roomId);
  const myId = Number(me);

  // از DM conversations موجود: partnerId همان key آبجکت است
  const dm = d.individualMessages || {};
  for (const pidStr of Object.keys(dm)) {
    const conv = dm[pidStr];
    if (Number(conv?.roomId) === rid) return Number(pidStr);
  }

  // اگر room object با users هم در packet/msg باشد، می‌توانیم مستقیم هم استخراج کنیم
  // (اختیاری، اما کمک می‌کند)
  // توجه: شکل users ممکن است آرایه‌ای از {id,...} باشد.
  // این بخش را نگه می‌داریم چون اگر بعدها packet.room.users داشتی، بدون تغییر کار می‌کند.
  const roomUsers =
    d?.roomsById?.[rid]?.users || // اگر چنین state‌ای اضافه کردی
    null;

  if (Array.isArray(roomUsers)) {
    const other = roomUsers.find((u) => Number(u?.id) !== myId);
    if (other?.id != null) return Number(other.id);
  }

  return null;
};

// ✅ NEW: senderId/receiverId را هم برای schema قدیم و هم جدید بخوان
const getSenderReceiverCompat = (msg) => {
  // schema جدید:
  const senderId =
    msg?.user_id ?? msg?.sender_id ?? msg?.sender?.id ?? msg?.from_user_id ?? null;

  const receiverId =
    msg?.receiver_id ??
    msg?.to_user_id ??
    msg?.receiver?.id ??
    msg?.to?.id ??
    null;

  return { senderId, receiverId };
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

  // ✅ UPDATED: DM + GROUP + DEDUPE + SMART UNREAD + HISTORY LIMIT
  // پشتیبانی از schema جدید:
  // message: { id, chat_room_id, user_id, ... }
  // و schema قدیم:
  // message: { sender_id/sender, receiver_id/receiver, ... }
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

    // ✅ Prefer real backend id if exists
    const realId = msg?.id ?? msg?.message_id ?? msg?.uuid ?? null;
    const msgId = realId ?? getMsgId(msg, roomId);

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
    // 1) اول تلاش: schema قدیم (sender/receiver) از helpers (اگر کار کند)
    let senderId;
    let receiverId;

    try {
      const legacy = getMsgIds?.(msg);
      senderId = legacy?.senderId ?? null;
      receiverId = legacy?.receiverId ?? null;
    } catch {
      senderId = null;
      receiverId = null;
    }

    // 2) اگر legacy نتوانست، از compat reader
    if (senderId == null) {
      const compat = getSenderReceiverCompat(msg);
      senderId = compat.senderId;
      receiverId = compat.receiverId;
    }

    // ✅ حالت A: schema قدیم (sender+receiver داریم)
    if (senderId != null && receiverId != null) {
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
      return;
    }

    // ✅ حالت B: schema جدید (فقط user_id داریم، receiver نداریم)
    if (senderId == null) {
      d.errorStates.messages = 'Invalid message schema (missing user_id/sender_id)';
      return;
    }

    // partnerId را از روی roomId در state پیدا کن
    let partnerId = getPartnerIdFromRoom(d, roomId, me);

    // اگر هنوز state کامل sync نشده، fallback منطقی:
    // اگر پیام از دیگری است → partner همان sender است
    if (!partnerId) {
      const fallbackPartner =
        Number(senderId) === Number(me) ? null : Number(senderId);
      if (fallbackPartner) partnerId = fallbackPartner;
    }

    if (!partnerId) {
      d.errorStates.messages = 'Cannot infer partnerId for DM room';
      return;
    }

    const existing = d.individualMessages[partnerId];
    const userObj = d.users?.[partnerId] || msg?.user || {};
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
