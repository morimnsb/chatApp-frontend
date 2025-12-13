// src/reducers/messageReducer.js
import { produce } from 'immer';
import messageActionTypes from '../actions/messageActionTypes';

const initialState = {
  currentUser: {},
  users: {},

  // map: { [partnerId]: conversationObj }
  // conversationObj نمونه:
  // {
  //   partnerId,
  //   roomId,
  //   first_name,
  //   last_message,
  //   last_message_at,
  //   unread_count,
  //   is_online,
  //   messages: [ ... ],
  // }
  individualMessages: {},

  // map: { [groupId]: groupConversationObj }
  groupMessages: {},

  selectedRoom: null,

  loadingStates: { users: false, messages: false },
  errorStates: { users: null, messages: null },

  typingIndicators: {}, // { [userId]: true|false }
};

const safeIsObject = (v) => v && typeof v === 'object';

// کمک: مقدار پیش‌فرض کانورسیشن
const makeDefaultConversation = (partnerId, userObj = {}, roomId = null) => ({
  partnerId,
  roomId: roomId ?? null,
  first_name:
    userObj.first_name ||
    userObj.firstName ||
    userObj.name ||
    userObj.email ||
    `User #${partnerId}`,
  last_message: null,
  last_message_at: null,
  unread_count: 0,
  is_online: !!userObj.is_online,
  messages: [],
});

const messageReducer = produce((draft, action) => {
  if (!action || typeof action !== 'object' || action.type == null) {
    console.warn('[messageReducer] invalid action', action);
    return;
  }

  switch (action.type) {
    /* ---------------- CURRENT USER / USERS ---------------- */

    case messageActionTypes.SET_CURRENT_USER: {
      if (!safeIsObject(action.payload)) {
        draft.errorStates.users = 'Invalid user data';
        break;
      }
      draft.currentUser = action.payload;
      break;
    }

    case messageActionTypes.SET_USERS: {
      if (!Array.isArray(action.payload)) {
        draft.errorStates.users = 'Invalid users data';
        break;
      }
      draft.users = action.payload.reduce((acc, user) => {
        if (safeIsObject(user) && user.id != null) acc[user.id] = user;
        return acc;
      }, {});
      break;
    }

    /* ---------------- INDIVIDUAL CONVERSATIONS ---------------- */

    // ✅ حالا این اکشن، کانورسیشن‌ها را ست می‌کند
    // payload می‌تواند:
    //  - یک map آماده { [partnerId]: convObj }
    //  - یا یک آرایه از convObjها باشد
    case messageActionTypes.SET_INDIVIDUAL_MESSAGES: {
      const payload = action.payload;

      // اگر map آماده است
      if (safeIsObject(payload) && !Array.isArray(payload)) {
        draft.individualMessages = { ...draft.individualMessages, ...payload };
        draft.errorStates.messages = null;
        break;
      }

      if (!Array.isArray(payload)) {
        draft.errorStates.messages = 'Invalid conversations data';
        break;
      }

      const map = payload.reduce((acc, conv) => {
        if (!safeIsObject(conv)) return acc;

        const partnerId =
          conv.partnerId || conv.partner_id || conv.user_id || conv.id || null;
        const roomId =
          conv.roomId ||
          conv.room_id ||
          conv.chat_room_id ||
          conv.room?.id ||
          null;

        if (!partnerId || !roomId) return acc;

        const userObj = draft.users?.[partnerId] || conv.user || {};
        const base = makeDefaultConversation(partnerId, userObj, roomId);

        acc[partnerId] = {
          ...base,
          ...conv, // هرچی از بک‌اند اومده override کنه
          partnerId,
          roomId,
        };

        return acc;
      }, {});

      draft.individualMessages = {
        ...draft.individualMessages,
        ...map,
      };
      draft.errorStates.messages = null;
      break;
    }

    case messageActionTypes.SET_GROUP_MESSAGES: {
      const payload = action.payload;

      if (safeIsObject(payload) && !Array.isArray(payload)) {
        draft.groupMessages = { ...draft.groupMessages, ...payload };
        draft.errorStates.messages = null;
        break;
      }

      if (!Array.isArray(payload)) {
        draft.errorStates.messages = 'Invalid group messages data';
        break;
      }

      draft.groupMessages = {
        ...draft.groupMessages,
        ...payload.reduce((acc, group) => {
          if (safeIsObject(group) && group.id != null) {
            acc[group.id] = group;
          }
          return acc;
        }, {}),
      };
      draft.errorStates.messages = null;
      break;
    }

    case messageActionTypes.SELECT_ROOM: {
      draft.selectedRoom = action.payload ?? null;
      break;
    }

    /* ---------------- LIVE MESSAGE UPDATES (WS / HTTP) ---------------- */

    // ChatWindow → dispatch(updateMessages(packet));
    // packet شکلش چیزی مثل اینه:
    // { type: 'message' | 'new_message_notification', message: {...} }
    case messageActionTypes.UPDATE_MESSAGES: {
      const packet = action.payload || {};
      const msg = safeIsObject(packet.message) ? packet.message : null;
      const isNewMessageNotification =
        packet.type === 'new_message_notification';

      if (!msg) {
        draft.errorStates.messages = 'Missing message payload';
        break;
      }

      const me =
        draft.currentUser &&
        (draft.currentUser.id ||
          draft.currentUser.user_id ||
          draft.currentUser.userId);

      if (!me) {
        draft.errorStates.messages = 'Current user not set';
        break;
      }

      const senderId = msg.sender_id ?? msg.senderId ?? msg.user_id;
      const receiverId = msg.receiver_id ?? msg.receiverId;
      const roomId = msg.chat_room_id ?? msg.room_id ?? msg.roomId ?? null;

      if (senderId == null || receiverId == null) {
        draft.errorStates.messages = 'Invalid message schema (sender/receiver)';
        break;
      }

      // partnerId = طرف مقابل
      const partnerId = Number(me) === Number(senderId) ? receiverId : senderId;

      // کانورسیشن فعلی یا جدید
      const existing = draft.individualMessages[partnerId];
      const userObj = draft.users?.[partnerId] || {};
      const conversation =
        existing || makeDefaultConversation(partnerId, userObj, roomId);

      if (!conversation.roomId && roomId) {
        conversation.roomId = roomId;
      }

      // آخرین پیام + زمان آخرین پیام
      conversation.last_message = msg;
      conversation.last_message_at =
        msg.created_at || msg.timestamp || new Date().toISOString();

      // آرایهٔ messages
      if (!Array.isArray(conversation.messages)) {
        conversation.messages = [];
      }
      conversation.messages.push(msg);

      // افزایش unread اگر پیام جدید از طرف مقابل است
      if (
        isNewMessageNotification ||
        Number(senderId) !== Number(me) // از طرف مقابل
      ) {
        conversation.unread_count = (conversation.unread_count || 0) + 1;
      }

      draft.individualMessages[partnerId] = conversation;
      draft.errorStates.messages = null;
      break;
    }

    case messageActionTypes.UPDATE_STATUS: {
      const { senderId, status } = action.payload || {};
      if (senderId != null && draft.individualMessages[senderId]) {
        draft.individualMessages[senderId].is_online = !!status;
      }
      break;
    }

    case messageActionTypes.CLEAR_UNREAD_COUNT: {
      const partnerId = action.payload;
      if (partnerId != null && draft.individualMessages[partnerId]) {
        draft.individualMessages[partnerId].unread_count = 0;
      }
      break;
    }

    /* ---------------- LOADING / ERROR / TYPING ---------------- */

    case messageActionTypes.SET_LOADING: {
      const { type, status } = action.payload || {};
      if (type) draft.loadingStates[type] = !!status;
      break;
    }

    case messageActionTypes.SET_ERROR: {
      const { type, message } = action.payload || {};
      draft.errorStates[type || 'messages'] = message || 'Unknown error';
      break;
    }

    case messageActionTypes.SET_TYPING_INDICATOR: {
      const { userId, isTyping } = action.payload || {};
      if (userId != null) draft.typingIndicators[userId] = !!isTyping;
      break;
    }

    case messageActionTypes.RESET_TYPING_INDICATOR: {
      const { userId } = action.payload || {};
      if (userId != null) delete draft.typingIndicators[userId];
      break;
    }

    case messageActionTypes.DELETE_MESSAGE: {
      const { messageId, partnerId } = action.payload || {};
      const conv =
        partnerId != null ? draft.individualMessages[partnerId] : null;

      if (conv && Array.isArray(conv.messages)) {
        conv.messages = conv.messages.filter((m) => m && m.id !== messageId);
      }
      break;
    }

    default:
      break;
  }
}, initialState);

export default messageReducer;
