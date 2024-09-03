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

// Helper function to find the index of a conversation by sender ID
const findConversationIndex = (conversations, senderId) => {


  return conversations.findIndex((conv) => conv.id === senderId);
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
      const { message } = action.payload;
      const msg = message.message;
      const type = message.type;
      const isNewMessageNotification = type === 'new_message_notification';


      const senderId = msg.sender_id;
      const receiverId = msg.receiver_id;

      // Determine the ID to use for finding or creating the conversation
      const conversationId =
        state.currentUser === senderId ? receiverId : senderId;

      // Find the index of the existing conversation
      const existingConversationIndex = findConversationIndex(
        state.individualMessages,
        conversationId,
      );

      // Handle the conversation update based on whether it exists or not
      let newIndividualMessages;
      if (existingConversationIndex !== -1) {
        // Conversation exists, update the last_message and increment unread_count
        newIndividualMessages = state.individualMessages.map((conv, index) =>
          index === existingConversationIndex
            ? {
                ...conv,
                last_message: msg,
                unread_count: isNewMessageNotification
                  ? (conv.unread_count || 0) + 1
                  : conv.unread_count,
              }
            : conv,
        );

      } else {
        // Conversation does not exist, create a new conversation
        const newConversation = {
          id: conversationId,
          first_name: '', // Default to empty in case user is not found
          last_message: msg,
          unread_count: isNewMessageNotification ? 1 : 0,
          typing: false,
          is_online: false, // Default to false in case user is not found
        };

        // Find the user from the users array using conversationId
        const user = state.users.find((user) => user.id === conversationId);

        if (user) {
          newConversation.first_name = user.first_name;
          newConversation.is_online = user.is_online;
        }

        newIndividualMessages = [newConversation, ...state.individualMessages];
      }

      return {
        ...state,
        individualMessages: newIndividualMessages,
      };
    }

    case messageActionTypes.UPDATE_STATUS: {
      const { senderId, status } = action.payload;

      const existingConversationIndex = findConversationIndex(
        state.individualMessages,
        senderId,
      );

      if (existingConversationIndex !== -1) {
        return {
          ...state,
          individualMessages: state.individualMessages.map((conv, index) =>
            index === existingConversationIndex
              ? { ...conv, is_online: status }
              : conv,
          ),
        };
      }
      return state; // No change if the conversation doesn't exist
    }

    case messageActionTypes.CLEAR_UNREAD_COUNT: {
      const conversationId = action.payload;

      const existingConversationIndex = findConversationIndex(
        state.individualMessages,
        conversationId,
      );

      if (existingConversationIndex !== -1) {
        return {
          ...state,
          individualMessages: state.individualMessages.map((conv, index) =>
            index === existingConversationIndex
              ? { ...conv, unread_count: 0 }
              : conv,
          ),
        };
      }
      return state; // No change if the conversation doesn't exist
    }

    // case messageActionTypes.UPDATE_LAST_MESSAGE: {
    //   const { senderId, lastMessage } = action.payload;

    //   const existingConversationIndex = findConversationIndex(
    //     state.individualMessages,
    //     senderId,
    //   );

    //   if (existingConversationIndex !== -1) {
    //     return {
    //       ...state,
    //       individualMessages: state.individualMessages.map((conv, index) =>
    //         index === existingConversationIndex
    //           ? { ...conv, last_message: lastMessage }
    //           : conv,
    //       ),
    //     };
    //   }
    //   return state; // No change if the conversation doesn't exist
    // }

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

    case messageActionTypes.SET_TYPING_INDICATOR: {
      const { userId, isTyping } = action.payload;

      return {
        ...state,
        typingIndicators: {
          ...state.typingIndicators,
          [userId]: isTyping,
        },
      };
    }

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
