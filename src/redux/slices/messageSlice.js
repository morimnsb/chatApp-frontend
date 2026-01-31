// src/redux/slices/messageSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  currentUser: null,
  users: [],

  // Conversation lists (NOT messages inside room)
  individualMessages: [],
  groupMessages: [],

  selectedRoom: null,

  typingIndicators: {},
  statusByUserId: {},
  unreadCountByConversationId: {},

  loading: false,
  error: '',
};

const safeArr = (v) => (Array.isArray(v) ? v : []);
const toStr = (v) => (v == null ? '' : String(v));
const eqId = (a, b) => a != null && b != null && toStr(a) === toStr(b);

const clip = (s, n = 80) => {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

function getRoomId(packet, msg) {
  return (
    packet?.room_id ??
    packet?.roomId ??
    msg?.room_id ??
    msg?.chat_room_id ??
    msg?.roomId ??
    null
  );
}

function normalizeMsg(packet) {
  const msg = packet?.message ?? packet?.payload ?? null;
  if (!msg || typeof msg !== 'object') return null;

  const roomId = getRoomId(packet, msg);
  const userObj = msg?.user || msg?.sender || packet?.from_user || null;

  const senderId =
    msg?.sender_id ?? msg?.user_id ?? userObj?.id ?? packet?.sender_id ?? null;

  const senderName =
    msg?.sender_name ?? userObj?.name ?? packet?.sender_name ?? null;

  const content =
    msg?.content ?? msg?.text ?? packet?.text ?? packet?.preview ?? '';

  const createdAt =
    msg?.created_at ?? msg?.timestamp ?? packet?.created_at ?? new Date().toISOString();

  return {
    ...msg,
    room_id: msg?.room_id ?? roomId,
    chat_room_id: msg?.chat_room_id ?? roomId,
    sender_id: senderId ?? null,
    sender_name: senderName ?? null,
    content: content ?? '',
    created_at: createdAt,
  };
}

function bumpUnread(state, roomId) {
  if (roomId == null) return;
  const selected = state.selectedRoom;
  if (!selected || !eqId(selected, roomId)) {
    state.unreadCountByConversationId[roomId] =
      (state.unreadCountByConversationId[roomId] ?? 0) + 1;
  }
}

function updateConversation(convo, msg) {
  return {
    ...convo,
    last_message_obj: msg,
    last_message: msg,
    last_message_text: clip(msg?.content || '', 200),
    last_message_at: msg?.created_at || new Date().toISOString(),
  };
}

function findDMIndex(list, roomId) {
  return list.findIndex((c) =>
    eqId(c?.roomId ?? c?.room_id ?? c?.chat_room_id ?? c?.id, roomId),
  );
}

const messageSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    setIndividualMessages(state, action) {
      state.individualMessages = safeArr(action.payload);
    },
    setGroupMessages(state, action) {
      state.groupMessages = safeArr(action.payload);
    },
    selectRoom(state, action) {
      state.selectedRoom = action.payload ?? null;
      if (state.selectedRoom != null) {
        state.unreadCountByConversationId[state.selectedRoom] = 0;
      }
    },

    // ✅ ConversationList update ONLY via global-notif
    updateFromPacket(state, action) {
      const packet = action.payload;
      if (!packet || typeof packet !== 'object') return;

      // ✅ فقط از global-notif اجازه بده conversation list آپدیت شود
      if (packet?.meta?.via !== 'global-notif') return;

      const kind = packet.kind || packet.type;
      if (kind !== 'notify' && kind !== 'message_notify' && kind !== 'notify_message') return;

      const msg = normalizeMsg(packet);
      if (!msg) return;

      const roomId = getRoomId(packet, msg);
      if (roomId == null) return;

      // ✅ DM فرض میکنیم (چون user-channel notify برای DM است)
      const idx = findDMIndex(state.individualMessages, roomId);

      if (idx !== -1) {
        // ✅ فقط update fields + move to top
        const updated = updateConversation(state.individualMessages[idx], msg);
        state.individualMessages.splice(idx, 1);
        state.individualMessages.unshift(updated);
      } else {
        // ✅ اگر واقعاً وجود نداشت، بساز (اولین بار)
        state.individualMessages.unshift(
          updateConversation(
            {
              roomId,
              room_id: roomId,
              chat_room_id: roomId,
              partnerId: msg?.sender_id ?? null,
              partner_id: msg?.sender_id ?? null,
              first_name: msg?.sender_name ?? null,
              name: msg?.sender_name ?? null,
              is_group: false,
            },
            msg,
          ),
        );
      }

      // ✅ unread
      bumpUnread(state, roomId);
    },
  },
});

export const {
  setIndividualMessages,
  setGroupMessages,
  selectRoom,
  updateFromPacket,
} = messageSlice.actions;

export default messageSlice.reducer;
