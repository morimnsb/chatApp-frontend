import { produce } from 'immer';
import messageActionTypes from '../actions/messageActionTypes';

const initialState = {
  currentUser: {},
  users: {},
  individualMessages: {},   // map: { [userId]: conversationObj }
  groupMessages: {},        // map: { [groupId]: messageObj } (اگر لازم)
  selectedRoom: null,
  loadingStates: { users: false, messages: false },
  errorStates: { users: null, messages: null },
  typingIndicators: {},
};

// کمک: اگر نبود، مقدار پیش‌فرض بساز
const findOrCreateConversation = (conversations, conversationId, defaultData) =>
  conversations[conversationId] || defaultData;

const safeIsObject = (v) => v && typeof v === 'object';

const messageReducer = produce((draft, action) => {
  // گارد اکشن
  if (!action || typeof action !== 'object' || action.type == null) {
    console.warn('[messageReducer] invalid action', action);
    return;
  }

  switch (action.type) {
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

    case messageActionTypes.SET_INDIVIDUAL_MESSAGES: {
      if (!Array.isArray(action.payload)) {
        draft.errorStates.messages = 'Invalid messages data';
        break;
      }
      draft.individualMessages = {
        ...draft.individualMessages,
        ...action.payload.reduce((acc, msg) => {
          if (safeIsObject(msg) && msg.id != null) acc[msg.id] = msg;
          return acc;
        }, {}),
      };
      break;
    }

    case messageActionTypes.SET_GROUP_MESSAGES: {
      if (!Array.isArray(action.payload)) {
        draft.errorStates.messages = 'Invalid group messages data';
        break;
      }
      draft.groupMessages = {
        ...draft.groupMessages,
        ...action.payload.reduce((acc, msg) => {
          if (safeIsObject(msg) && msg.id != null) acc[msg.id] = msg;
          return acc;
        }, {}),
      };
      break;
    }

    case messageActionTypes.SELECT_ROOM: {
      draft.selectedRoom = action.payload ?? null;
      break;
    }

    case messageActionTypes.UPDATE_MESSAGES: {
      // ساختار ورودی مورد انتظار:
      // payload = { message: { type: 'new_message_notification'|'message', message: {...} } }
      const p = action.payload || {};
      const wrapper = safeIsObject(p.message) ? p.message : null;
      const msg = safeIsObject(wrapper?.message) ? wrapper.message : null;
      const isNewMessageNotification =
        wrapper?.type === 'new_message_notification';

      if (!safeIsObject(draft.currentUser) || !draft.users || !msg) {
        draft.errorStates.messages = 'User or message data missing';
        console.error('User or message data missing:', {
          currentUser: draft.currentUser,
          users: draft.users,
          msg,
        });
        break;
      }

      const senderId = msg.sender_id ?? msg.senderId;
      const receiverId = msg.receiver_id ?? msg.receiverId;

      if (senderId == null || receiverId == null) {
        draft.errorStates.messages =
          'Invalid message schema (sender/receiver missing)';
        break;
      }

      const meId =
        draft.currentUser.id ??
        draft.currentUser.user_id ??
        draft.currentUser.userId;
      const conversationId = meId === senderId ? receiverId : senderId;

      const conversation = findOrCreateConversation(
        draft.individualMessages,
        conversationId,
        {
          id: conversationId,
          first_name: draft.users[conversationId]?.first_name || '',
          last_message: null,
          unread_count: 0,
          typing: false,
          is_online: !!draft.users[conversationId]?.is_online,
          // اختیاری: اگر بخواهی لیست پیام‌ها را هم ذخیره کنی
          messages: [],
        },
      );

      conversation.last_message = msg;
      if (Array.isArray(conversation.messages)) {
        conversation.messages.push(msg);
      }
      if (isNewMessageNotification) {
        conversation.unread_count = (conversation.unread_count || 0) + 1;
      }

      draft.individualMessages[conversationId] = conversation;
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
      const conversationId = action.payload;
      if (conversationId != null && draft.individualMessages[conversationId]) {
        draft.individualMessages[conversationId].unread_count = 0;
      }
      break;
    }

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
      const { messageId, conversationId } = action.payload || {};
      const conv =
        conversationId != null
          ? draft.individualMessages[conversationId]
          : null;

      // اگر کانورسیشن ساختار messages:[] دارد، از آن حذف کن
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
