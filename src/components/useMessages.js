import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setIndividualMessages as setMessagesAction,
  updateMessages as updateMessagesAction,
  resetTypingIndicator as resetTypingIndicatorAction,
} from './store/actions/messageActions'; // Ensure correct import path

const useMessages = () => {
  const dispatch = useDispatch();
  const individualMessages = useSelector(
    (state) => state.messages.individualMessages,
  );

  // Debugging utility function
  const logAction = (action) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('Dispatching action:', action);
    }
  };

  const setIndividualMessages = useCallback(
    (messages) => {
      const action = setMessagesAction(messages);
      logAction(action);
      dispatch(action);
    },
    [dispatch],
  );

  const updateMessages = useCallback(
    (msg, isTyping = false, isStatus = false) => {
      const action = updateMessagesAction(msg, isTyping, isStatus);
      logAction(action);
      dispatch(action);
    },
    [dispatch],
  );

  const resetTypingIndicator = useCallback(
    (userId) => {
      const action = resetTypingIndicatorAction(userId);
      logAction(action);
      dispatch(action);
    },
    [dispatch],
  );

  return {
    individualMessages,
    setIndividualMessages,
    updateMessages,
    resetTypingIndicator,
  };
};

export default useMessages;
