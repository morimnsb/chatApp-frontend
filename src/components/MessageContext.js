import React, { createContext, useContext, useReducer } from 'react';
import { messageReducer, initialState } from '../reducers/messageReducer';

const MessageContext = createContext();

export const MessageProvider = ({ children }) => {
  const [state, dispatch] = useReducer(messageReducer, initialState);

  return (
    <MessageContext.Provider value={{ state, dispatch }}>
      {children}
    </MessageContext.Provider>
  );
};

export const useMessages = () => useContext(MessageContext);
