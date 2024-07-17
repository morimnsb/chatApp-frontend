import { useEffect } from 'react';
import useWebSocket from 'react-use-websocket';

const useChatWebSocket = (socketUrl, handleNotification) => {
  const { lastJsonMessage } = useWebSocket(socketUrl);

  useEffect(() => {
    if (lastJsonMessage !== null) {
      handleNotification(lastJsonMessage);
    }
  }, [lastJsonMessage, handleNotification]);
};

export default useChatWebSocket;
