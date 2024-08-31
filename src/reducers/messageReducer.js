// src/store/reducers/messageReducer.js
import messageActionTypes from '../actions/messageActionTypes';

const initialState = {
  currentUser: null,
  users: [],
  individualMessages: [],
  groupMessages: [],
  selectedRoom: null,
  loading: false,
  error: null,
  typingIndicators: {},
};

const messageReducer = (state = initialState, action) => {
  switch (action.type) {
    case messageActionTypes.SET_CURRENT_USER:
      return {
        ...state,
        currentUser: action.payload,
      };

    case messageActionTypes.SET_USERS:
      return {
        ...state,
        users: action.payload,
      };

    case messageActionTypes.SET_INDIVIDUAL_MESSAGES:
      return {
        ...state,
        individualMessages: Array.isArray(action.payload) ? action.payload : [],
      };

    case messageActionTypes.SET_GROUP_MESSAGES:
      return {
        ...state,
        groupMessages: Array.isArray(action.payload) ? action.payload : [],
      };

    case messageActionTypes.SELECT_ROOM:
      return {
        ...state,
        selectedRoom: action.payload,
      };

    case messageActionTypes.UPDATE_MESSAGES: {
      const { msg, isTyping, isStatus } = action.payload;
      console.log('msg:', msg);
      console.log('msg.sender_id:', msg.sender_id);
      const existingConversation = state.individualMessages.find(
        (conv) => conv.id === msg.sender_id,
      );

      if (existingConversation) {
        return {
          ...state,
          individualMessages: state.individualMessages.map((conv) =>
            conv.id === msg.sender_id
              ? {
                  ...conv,
                  ...(isTyping && {
                    typing: true,
                  }),
                  ...(isStatus && {
                    is_online: msg.status,
                  }),
                  ...(!isTyping &&
                    !isStatus && {
                      last_message: msg,
                      unread_count: (conv.unread_count || 0) + 1,
                    }),
                }
              : conv,
          ),
        };
      } else {
        return {
          ...state,
          individualMessages: [
            {
              id: msg.sender_id,
              first_name: msg.sender_first_name,
              last_message: msg,
              unread_count: 1,
              typing: isTyping || false,
              is_online: isStatus ? msg.status : true,
            },
            ...state.individualMessages,
          ],
        };
      }
    }

    case messageActionTypes.CLEAR_UNREAD_COUNT:
      return {
        ...state,
        individualMessages: state.individualMessages.map((conv) =>
          conv.id === action.payload ? { ...conv, unread_count: 0 } : conv,
        ),
      };

    case messageActionTypes.UPDATE_LAST_MESSAGE:
      console.log('UPDATE_LAST_MESSAGE is called');

      // Log the incoming action payload
      console.log('Action Payload:', action.payload);

      // Log the current state to inspect the individualMessages array
      console.log('Current State:', state);

      // Debugging each conversation
      const updatedMessages = state.individualMessages.map((conv) => {
        console.log('Processing Conversation:', conv);

        if (conv.id === action.payload.senderId) {
          console.log('Updating Conversation:', conv);
          return { ...conv, last_message: action.payload.lastMessage };
        } else {
          return conv;
        }
      });

      console.log('Updated Messages:', updatedMessages);

      return {
        ...state,
        individualMessages: updatedMessages,
      };

    case messageActionTypes.SET_LOADING:
      return {
        ...state,
        loading: action.payload,
      };

    case messageActionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload,
      };

    case messageActionTypes.SET_TYPING_INDICATOR:
      const { userId, isTyping } = action.payload;

      console.log('SET_TYPING_INDICATOR is called');
      console.log('userId', userId);
      console.log('isTyping', isTyping);

      return {
        ...state,
        typingIndicators: {
          ...state.typingIndicators,
          [userId]: isTyping,
        },
      };

    case messageActionTypes.RESET_TYPING_INDICATOR: {
      const { userId } = action.payload;
      const { [userId]: _, ...rest } = state.typingIndicators;
      return {
        ...state,
        typingIndicators: rest,
      };
    }

    default:
      return state;
  }
};

export default messageReducer;
