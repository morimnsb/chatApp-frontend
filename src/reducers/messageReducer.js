import { produce } from 'immer';
import messageActionTypes from '../actions/messageActionTypes';

const initialState = {
  currentUser: {},
  users: {},
  individualMessages: {},
  groupMessages: {},
  selectedRoom: null,
  loadingStates: {
    users: false,
    messages: false,
  },
  errorStates: {
    users: null,
    messages: null,
  },
  typingIndicators: {},
};

const findOrCreateConversation = (
  conversations,
  conversationId,
  defaultData,
) => {
  return conversations[conversationId] || defaultData;
};

const messageReducer = produce((draft, action) => {
  switch (action.type) {
    case messageActionTypes.SET_CURRENT_USER:
      if (!action.payload) {
        draft.errorStates.users = 'Invalid user data';

        break;
      }
      draft.currentUser = action.payload;

      break;

    case messageActionTypes.SET_USERS:
      if (!Array.isArray(action.payload)) {
        draft.errorStates.users = 'Invalid users data';
        break;
      }
      draft.users = action.payload.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});
      break;

    case messageActionTypes.SET_INDIVIDUAL_MESSAGES:
      if (!Array.isArray(action.payload)) {
        draft.errorStates.messages = 'Invalid messages data';
        break;
      }
      draft.individualMessages = {
        ...draft.individualMessages,
        ...action.payload.reduce((acc, msg) => {
          acc[msg.id] = msg;
          return acc;
        }, {}),
      };
      break;

    case messageActionTypes.SET_GROUP_MESSAGES:
      if (!Array.isArray(action.payload)) {
        draft.errorStates.messages = 'Invalid group messages data';
        break;
      }
      draft.groupMessages = {
        ...draft.groupMessages,
        ...action.payload.reduce((acc, msg) => {
          acc[msg.id] = msg;
          return acc;
        }, {}),
      };
      break;

    case messageActionTypes.SELECT_ROOM:
      draft.selectedRoom = action.payload;
      break;
    
    case messageActionTypes.UPDATE_MESSAGES: {
  const { message } = action.payload;
  const msg = message?.message;
  const isNewMessageNotification =
    message?.type === 'new_message_notification';



  if (!draft.currentUser || !draft.users || !msg) {
    draft.errorStates.messages = 'User or message data missing';
    console.error('User or message data missing:', {
      currentUser: draft.currentUser,
      users: draft.users,
      msg,
    });
    break;
  }

  const conversationId =
    draft.currentUser === msg.sender_id
      ? msg.receiver_id
      : msg.sender_id;



  const conversation = findOrCreateConversation(
    draft.individualMessages,
    conversationId,
    {
      id: conversationId,
      first_name: draft.users[conversationId]?.first_name || '',
      last_message: null,
      unread_count: 0,
      typing: false,
      is_online: draft.users[conversationId]?.is_online || false,
    },
  );



  conversation.last_message = msg;
  if (isNewMessageNotification) {
    conversation.unread_count += 1;
  }

  draft.individualMessages[conversationId] = conversation;

 
  break;
}


    case messageActionTypes.UPDATE_STATUS: {
      const { senderId, status } = action.payload;
      if (draft.individualMessages[senderId]) {
        draft.individualMessages[senderId].is_online = status;
      }
      break;
    }

    case messageActionTypes.CLEAR_UNREAD_COUNT: {
      const conversationId = action.payload;
      if (draft.individualMessages[conversationId]) {
        draft.individualMessages[conversationId].unread_count = 0;
      }
      break;
    }

    case messageActionTypes.SET_LOADING:
      draft.loadingStates[action.payload.type] = action.payload.status;
      break;

    case messageActionTypes.SET_ERROR:
      draft.errorStates[action.payload.type] =
        action.payload.errorType === 'network'
          ? 'Network error. Please try again.'
          : 'Unknown error occurred.';
      break;

    case messageActionTypes.SET_TYPING_INDICATOR: {
      const { userId, isTyping } = action.payload;
      draft.typingIndicators[userId] = isTyping;
      break;
    }

    case messageActionTypes.RESET_TYPING_INDICATOR: {
      const { userId } = action.payload;
      delete draft.typingIndicators[userId];
      break;
    }

    case messageActionTypes.DELETE_MESSAGE: {
      const { messageId, conversationId } = action.payload;
      if (draft.individualMessages[conversationId]) {
        delete draft.individualMessages[conversationId][messageId];
      }
      break;
    }

    default:
      break;
  }
}, initialState);

export default messageReducer;
