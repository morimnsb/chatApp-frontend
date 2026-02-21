//chatApp-frontend\src\features\chat\hooks\useChatWebSocket.ts
import { useEffect, useCallback, useMemo } from "react";
import useWebSocket from "react-use-websocket";

export type WSReadyState = number; // react-use-websocket exports ReadyState enum but number is fine here

export type UseChatWebSocketResult<T = unknown> = {
  sendJsonMessage: (message: any, keep?: boolean) => void;
  readyState: WSReadyState;
  connected: boolean;
};

export default function useChatWebSocket<TMessage = unknown>(
  socketUrl: string | null,
  handleNotification: ((msg: TMessage) => void) | null | undefined,
  enabled: boolean = true
): UseChatWebSocketResult<TMessage> {
  // هرگز هوک‌ها را شرطی نخوان! فقط ورودی‌ها را طوری بده که هوک خودش غیرفعال شود.
  const shouldConnect = Boolean(enabled && socketUrl);

  const { lastJsonMessage, sendJsonMessage, readyState, getWebSocket } =
    useWebSocket<TMessage>(
      shouldConnect ? (socketUrl as string) : null,
      {
        onOpen: () => console.log("WebSocket connection opened"),
        onClose: (event) => console.log("WebSocket connection closed", event),
        onError: (error) => console.error("WebSocket error", error),
        shouldReconnect: () => true,
      },
      shouldConnect
    );

  // کال‌بک همیشه تعریف شود (شرطی نباشد)
  const handleMessage = useCallback(
    (message: TMessage) => {
      if (typeof handleNotification === "function") {
        handleNotification(message);
      }
    },
    [handleNotification]
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

    const handleBeforeUnload = () => {
      try {
        const socket = getWebSocket?.();
        socket && socket.close();
      } catch {
        // ignore
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [getWebSocket, shouldConnect]);

  // خروجی ثابت (بدون شرط)
  return useMemo(
    () => ({
      sendJsonMessage,
      readyState,
      connected: shouldConnect,
    }),
    [sendJsonMessage, readyState, shouldConnect]
  );
}