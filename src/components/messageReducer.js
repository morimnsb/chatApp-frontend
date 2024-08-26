export const messageActionTypes = {
  SET_INDIVIDUAL_MESSAGES: 'SET_INDIVIDUAL_MESSAGES',
  UPDATE_MESSAGES: 'UPDATE_MESSAGES',
  RESET_TYPING_INDICATOR: 'RESET_TYPING_INDICATOR',
};

const debug = (label, data) => {
  if (process.env.NODE_ENV === 'development') {
    console.debug(label, data);
  }
};

export const messageReducer = (state, action) => {
  console.group(`Action: ${action.type}`);
  debug('Action Payload:', action.payload);
  debug('Current State:', state);

  let newState;

  switch (action.type) {
    case messageActionTypes.SET_INDIVIDUAL_MESSAGES:
      console.log('Setting individual messages:', action.payload);
      newState = {
        ...state,
        individualMessages: Array.isArray(action.payload) ? action.payload : [],
      };
      break;

    case messageActionTypes.UPDATE_MESSAGES:
      const { msg, isTyping } = action.payload;
      console.log('Updating messages with:', msg, 'Is Typing:', isTyping);
      console.log('state.individualMessages:', state.individualMessages);

      // Ensure individualMessages is an array
      if (!Array.isArray(state.individualMessages)) {
        console.warn(
          'state.individualMessages is not an array:',
          state.individualMessages,
        );
        newState = state;
        break;
      }

      // Check if there's an existing conversation
      const existingConversation = state.individualMessages.find(
        (conv) => conv.id === msg.sender_id,
      );
      console.log('Existing Conversation:', existingConversation);

      if (existingConversation) {
        // Update existing conversation
        newState = {
          ...state,
          individualMessages: state.individualMessages.map((conv) =>
            conv.id === msg.sender_id
              ? isTyping
                ? {
                    ...conv,
                    last_message: {
                      ...conv.last_message,
                      content: 'Typing...',
                      originalContent: conv.last_message?.content || '',
                    },
                  }
                : {
                    ...conv,
                    last_message: msg,
                    unread_count: (conv.unread_count || 0) + 1,
                  }
              : conv,
          ),
        };
        console.log(
          'Updated existing conversation:',
          newState.individualMessages,
        );
      } else {
        console.log('No existing conversation found. Is Typing:', isTyping);

        // Add new conversation if not typing
        if (isTyping) {
          console.log('Is typing indicator only, no new conversation added.');
          newState = state;
        } else {
          console.log('Adding new conversation with message:', msg);

          // Add the new conversation
          newState = {
            ...state,
            individualMessages: [
              ...state.individualMessages,
              {
                id: msg.sender_id,
                first_name: msg.sender_first_name,
                last_message: msg,
                unread_count: 1,
              },
            ],
          };

          console.log('New conversation added:', newState.individualMessages);
        }
      }
      break;

    case messageActionTypes.RESET_TYPING_INDICATOR:
      console.log('Resetting typing indicator for userId:', action.payload);
      newState = {
        ...state,
        individualMessages: state.individualMessages.map((conv) =>
          conv.id === action.payload
            ? {
                ...conv,
                last_message: {
                  ...conv.last_message,
                  content: conv.last_message?.originalContent || 'No message',
                },
              }
            : conv,
        ),
      };
      break;

    default:
      console.warn('Unhandled action type:', action.type);
      newState = state;
  }

  debug('New State:', newState);
  console.groupEnd();

  return newState;
};
