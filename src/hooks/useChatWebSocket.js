// src/hooks/useChatWebSocket.js
import { useEffect, useCallback, useMemo } from 'react';
import useWebSocket from 'react-use-websocket';

/**
 * useChatWebSocket
 * @param {string|null} socketUrl - آدرس WS یا null
 * @param {(msg:any)=>void} handleNotification
 * @param {boolean} enabled - اگر false باشد اتصال برقرار نمی‌شود
 */
export default function useChatWebSocket(
  socketUrl,
  handleNotification,
  enabled = true,
) {
  // هرگز هوک‌ها را شرطی نخوان! فقط ورودی‌ها را طوری بده که هوک خودش غیرفعال شود.
  const shouldConnect = Boolean(enabled && socketUrl);

  const { lastJsonMessage, sendJsonMessage, readyState, getWebSocket } =
    useWebSocket(
      shouldConnect ? socketUrl : null,
      {
        onOpen: () => console.log('WebSocket connection opened'),
        onClose: (event) => console.log('WebSocket connection closed', event),
        onError: (error) => console.error('WebSocket error', error),
        shouldReconnect: () => true,
      },
      shouldConnect,
    ); // نکته: گزینه‌ی سوم کتابخانه، فعال/غیرفعال بودن را می‌گیرد

  // کال‌بک همیشه تعریف شود (شرطی نباشد)
  const handleMessage = useCallback(
    (message) => {
      if (typeof handleNotification === 'function') {
        handleNotification(message);
      }
    },
    [handleNotification],
  );

  // واکنش به پیام‌های جدید — داخل افکت گارد بگذار
  useEffect(() => {
    if (!shouldConnect) return;
    if (lastJsonMessage !== null) {
      handleMessage(lastJsonMessage);
    }
  }, [lastJsonMessage, handleMessage, shouldConnect]);

  // تمیزکاری قبل از بستن صفحه
  useEffect(() => {
    if (!shouldConnect) return;
    const socket = getWebSocket?.();
    const handleBeforeUnload = () => {
      try {
        socket && socket.close();
      } catch (_) {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [getWebSocket, shouldConnect]);

  // خروجی ثابت (بدون شرط)
  return useMemo(
    () => ({
      sendJsonMessage,
      readyState,
      connected: shouldConnect,
    }),
    [sendJsonMessage, readyState, shouldConnect],
  );
}
