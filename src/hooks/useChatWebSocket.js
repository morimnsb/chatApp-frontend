// useChatWebSocket.js

import { useEffect, useCallback } from 'react';
import useWebSocket from 'react-use-websocket';

const useChatWebSocket = (socketUrl, handleNotification) => {
  const { lastJsonMessage, sendJsonMessage, readyState, getWebSocket } =
    useWebSocket(socketUrl, {
      onOpen: () => console.log('WebSocket connection opened'),
      onClose: (event) => console.log('WebSocket connection closed', event),
      onError: (error) => console.error('WebSocket error', error),
      shouldReconnect: (closeEvent) => true, // Automatically reconnect on connection loss
    });

  const handleMessage = useCallback(
    (message) => {
      handleNotification(message);
    },
    [handleNotification],
  );

  useEffect(() => {
    if (lastJsonMessage !== null) {
      console.log("lastJsonMessage", lastJsonMessage)
      handleMessage(lastJsonMessage);
    }
  }, [lastJsonMessage, handleMessage]);

  useEffect(() => {
    const socket = getWebSocket();

    const handleBeforeUnload = () => {
      if (socket) {
        socket.close();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [getWebSocket]);

  return {
    sendJsonMessage,
    readyState,
  };
};

export default useChatWebSocket;
