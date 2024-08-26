// useMessages.js

import { useCallback, useReducer } from 'react';
import { messageReducer, messageActionTypes } from './messageReducer'; // Ensure correct import path

const useMessages = () => {
  const [state, dispatch] = useReducer(messageReducer, {
    individualMessages: [],
  });

  // Debugging utility function
  const logAction = (action) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('Dispatching action:', action);
    }
  };

  const setIndividualMessages = useCallback((messages) => {
    const action = {
      type: messageActionTypes.SET_INDIVIDUAL_MESSAGES,
      payload: messages,
    };
    logAction(action);
    dispatch(action);
  }, []);

  const updateMessages = useCallback((msg, isTyping = false) => {
    const action = {
      type: messageActionTypes.UPDATE_MESSAGES,
      payload: { msg, isTyping },
    };
    logAction(action);
    dispatch(action);
  }, []);

  const resetTypingIndicator = useCallback((userId) => {
    const action = {
      type: messageActionTypes.RESET_TYPING_INDICATOR,
      payload: userId,
    };
    logAction(action);
    dispatch(action);
  }, []);

  return {
    individualMessages: state.individualMessages,
    setIndividualMessages,
    updateMessages,
    resetTypingIndicator,
  };
};

export default useMessages;
