import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Form, Button, Spinner, Alert } from "react-bootstrap";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";

import apiClient, { http } from "@/shared/api/apiClient";
import { resetTypingIndicator, updateMessages } from "@/features/chat/state/messageActions";

import ChatMessagesList, { type ChatMessage } from "@/features/chat/components/ChatMessagesList";
import TypingIndicator from "@/features/chat/components/TypingIndicator";

import { useAutoScroll } from "@/features/chat/hooks/useAutoScroll";
import { useDocTitleBadge } from "@/features/chat/hooks/useDocTitleBadge";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { selectCurrentUserId } from "@/app/store/authSlice";

/* ----------------------------- types (local) ----------------------------- */

type TransportStatus = "idle" | "connecting" | "connected" | "disconnected" | string;

export type SendTypingFn = (args: { roomId: number; isTyping: boolean }) => boolean;

export type IncomingPacket = {
  type?: "message" | "typing_indicator" | "typing" | string;
  room_id?: number | string;
  roomId?: number | string;
  chat_room_id?: number | string;
  user_id?: number | string;
  userId?: number | string;
  sender_id?: number | string;
  isTyping?: boolean;
  message?: any;
  data?: any;
  room?: any;
  [k: string]: any;
};

export type RegisterIncomingFn = (handler: (packet: IncomingPacket) => void) => void | (() => void);

type ChatWindowProps = {
  roomId: number | string | null;
  effectiveKind: string;
  accessToken?: string | null;

  transportStatus?: TransportStatus;
  connectionLabel?: string;

  sendTyping?: SendTypingFn;
  registerIncoming?: RegisterIncomingFn | null;
};

/* ----------------------------- helpers ----------------------------- */

const ROOM_TAG = "[ChatWindow]";

const isJwt = (t: unknown): t is string => typeof t === "string" && t.split(".").length === 3;

const stripBearer = (t: unknown): string =>
  String(t || "")
    .toString()
    .replace(/^Bearer\s+/i, "")
    .trim();

const toNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

type NormalizedMsg = ChatMessage & {
  sender_id?: number | string | null;
  user_id?: number | string | null;
  room_id?: number | string | null;
  chat_room_id?: number | string | null;
};

function normalizeMsg(raw: any): NormalizedMsg {
  if (!raw || typeof raw !== "object") return raw;

  const id = raw.id ?? raw.message_id ?? null;
  const roomId = raw.room_id ?? raw.chat_room_id ?? raw.roomId ?? null;
  const userId = raw.user_id ?? raw.sender_id ?? raw.userId ?? null;

  const content = raw.content ?? raw.text ?? raw.message ?? raw.body ?? null;
  const createdAt = raw.created_at ?? raw.createdAt ?? raw.ts ?? raw.timestamp ?? null;

  return {
    ...raw,
    id,
    room_id: roomId,
    chat_room_id: roomId,
    user_id: userId,
    sender_id: userId,
    content,
    created_at: createdAt,
  };
}

function SelectRoomPlaceholder() {
  return (
    <div className="no-chat-selected">
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>هیچ گفتگویی انتخاب نشده</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>از لیست سمت چپ یک گفتگو را انتخاب کن.</div>
      </div>
    </div>
  );
}

function isCanceled(err: any): boolean {
  return (
    err?.code === "ERR_CANCELED" ||
    err?.name === "CanceledError" ||
    err?.name === "AbortError" ||
    String(err?.message || "").toLowerCase().includes("canceled")
  );
}

/* ----------------------------- component ----------------------------- */

export default function ChatWindow({
  roomId,
  effectiveKind,
  accessToken: accessTokenProp,

  transportStatus = "idle",
  connectionLabel = "—",
  sendTyping = () => false,
  registerIncoming = null,
}: ChatWindowProps) {
  const dispatch = useAppDispatch();

  // ✅ typed currentUserId from auth slice
  const currentUserFromStore = useAppSelector(selectCurrentUserId);

  const accessToken = stripBearer(accessTokenProp || "");

  const backend = useMemo(() => String(effectiveKind || "").toLowerCase(), [effectiveKind]);

  const [messages, setMessages] = useState<NormalizedMsg[]>([]);
  const [messageInput, setMessageInput] = useState<string>("");
  const [uiError, setUiError] = useState<string | null>(null);
  const [typingUserId, setTypingUserId] = useState<number | string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(toNum(currentUserFromStore));

  // history meta
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<any>(null);

  const seenMessageIdsRef = useRef<Set<any>>(new Set());
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastNotifyAtRef = useRef<number>(0);
  const lastTypingUiAtRef = useRef<number>(0);
  const notifyAudioRef = useRef<HTMLAudioElement | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const { bump: bumpTitle } = useDocTitleBadge();
  const { containerRef, notifyNewMessage, scrollToBottom, showNewBadge, newCount } =
    useAutoScroll({ enabled: true, bottomThresholdPx: 140 });

  const roomIdNum = useMemo(() => {
    const n = toNum(roomId);
    return Number.isFinite(Number(n)) ? n : null;
  }, [roomId]);

  const historyUrl = useMemo(() => {
    if (!roomIdNum) return null;
    return `/chat/messages/${roomIdNum}/`;
  }, [roomIdNum, backend]);

  const sendUrl = useMemo(() => {
    if (!roomIdNum) return null;
    return `/chat/messages/${roomIdNum}/`;
  }, [roomIdNum, backend]);

  useEffect(() => {
    console.log(ROOM_TAG, "MOUNT", {
      roomId,
      roomIdNum,
      backend: effectiveKind,
      transportStatus,
      hasRegisterIncoming: typeof registerIncoming === "function",
      hasSendTyping: typeof sendTyping === "function",
      baseURL: (apiClient as any)?.defaults?.baseURL,
    });

    return () => {
      console.log(ROOM_TAG, "UNMOUNT", { roomId, roomIdNum });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log(ROOM_TAG, "PROPS", {
      roomId,
      roomIdNum,
      backend,
      transportStatus,
      connectionLabel,
      currentUserFromStore,
    });
  }, [roomId, roomIdNum, backend, transportStatus, connectionLabel, currentUserFromStore]);

  /* -------------------- HARD RESET when room changes -------------------- */
  useEffect(() => {
    setMessages([]);
    setMessageInput("");
    setUiError(null);
    setTypingUserId(null);
    setFetchError(null);

    seenMessageIdsRef.current = new Set();

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = null;

    setTimeout(() => scrollToBottom("auto"), 0);

    console.log(ROOM_TAG, "ROOM RESET", { roomId, roomIdNum, historyUrl });
  }, [roomId, roomIdNum, scrollToBottom, historyUrl]);

  /* -------------------- notifications init -------------------- */
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    notifyAudioRef.current = new Audio("/sounds/incoming.mp3");
  }, []);

  const showDesktopNotification = useCallback((title: string, body: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!document.hidden) return;

    try {
      new Notification(title, { body });
    } catch {}
  }, []);

  /* -------------------- currentUserId from store/JWT//me -------------------- */
  useEffect(() => {
    const idFromStore = toNum(currentUserFromStore);
    if (idFromStore) {
      setCurrentUserId(idFromStore);
      return;
    }

    if (isJwt(accessToken)) {
      try {
        const dec: any = jwtDecode(accessToken);
        const id = dec?.user_id ?? dec?.sub ?? null;
        if (id) {
          setCurrentUserId(Number(id));
          console.log(ROOM_TAG, "currentUserId from JWT", Number(id));
        }
      } catch (e: any) {
        console.warn(ROOM_TAG, "JWT decode skipped:", e?.message);
      }
    }
  }, [currentUserFromStore, accessToken]);

  useEffect(() => {
    const needFetchMe = !currentUserId && !!accessToken;
    if (!needFetchMe) return;

    let abort = false;

    (async () => {
      try {
        console.log(ROOM_TAG, "GET /auth/me (need currentUserId)");
        const me: any = await (http as any).get("/auth/me");
        if (!abort && me?.id) {
          setCurrentUserId(Number(me.id));
          console.log(ROOM_TAG, "currentUserId from /auth/me", Number(me.id));
        }
      } catch (e: any) {
        console.warn(ROOM_TAG, "[me] failed:", e?.message);
      }
    })();

    return () => {
      abort = true;
    };
  }, [currentUserId, accessToken]);

  /* -------------------- history fetch (HTTP) -------------------- */
  useEffect(() => {
    if (!roomIdNum || !historyUrl) return;

    setLoading(true);
    setFetchError(null);
    setUiError(null);

    console.log(ROOM_TAG, "HISTORY FETCH ->", {
      historyUrl,
      baseURL: (apiClient as any)?.defaults?.baseURL,
    });

    const cancelable = (http as any)?.cancelable?.get?.(historyUrl);
    if (!cancelable?.promise || !cancelable?.cancel) {
      console.error(ROOM_TAG, "http.cancelable.get is missing!");
      setLoading(false);
      setUiError("Internal error: cancelable HTTP not available.");
      return;
    }

    const { promise, cancel } = cancelable;

    promise
      .then((data: any) => {
        let arr: any[] = [];
        if (Array.isArray(data)) arr = data;
        else if (Array.isArray(data?.messages)) arr = data.messages;
        else if (Array.isArray(data?.data)) arr = data.data;

        const normalized = arr.map(normalizeMsg).filter((m) => m && (m as any).id != null);

        const seen = new Set<any>();
        for (const m of normalized) if ((m as any)?.id) seen.add((m as any).id);
        seenMessageIdsRef.current = seen;

        setMessages(normalized);

        setTimeout(() => scrollToBottom("auto"), 0);
        console.log(ROOM_TAG, "HISTORY LOADED", { roomId: roomIdNum, count: normalized.length });
      })
      .catch((e: any) => {
        if (isCanceled(e)) return;
        console.error(ROOM_TAG, "history fetch error", e);
        setFetchError(e);
        setUiError("Error fetching messages. Please try again.");
      })
      .finally(() => setLoading(false));

    return () => cancel();
  }, [roomIdNum, historyUrl, scrollToBottom]);

  /* -------------------- incoming realtime from parent -------------------- */
  const handleIncoming = useCallback(
    (packet: IncomingPacket) => {
      if (!packet) return;

      const type = packet?.type || (packet?.message ? "message" : "message");

      if (type === "message") {
        const m = normalizeMsg(packet?.message ?? packet);

        const packetRoomId = toNum((m as any)?.room_id ?? (m as any)?.chat_room_id);
        if (roomIdNum && packetRoomId && packetRoomId !== roomIdNum) return;

        if ((m as any)?.id && !seenMessageIdsRef.current.has((m as any).id)) {
          seenMessageIdsRef.current.add((m as any).id);
          setMessages((prev) => [...prev, m]);
          notifyNewMessage();
        }

        // ✅ no "as any" needed if your action creator is typed
        dispatch(
          updateMessages({
            type: "message",
            room_id: packetRoomId ?? roomIdNum,
            message: m,
          })
        );

        const senderId = (m as any)?.sender_id;
        const mine = Number(currentUserId);

        if (senderId && mine && Number(senderId) !== mine) {
          const now = Date.now();
          if (now - lastNotifyAtRef.current > 1200) {
            lastNotifyAtRef.current = now;
            toast?.info((m as any)?.content ?? "پیام جدید");
            notifyAudioRef.current?.play().catch(() => {});
            showDesktopNotification("پیام جدید", (m as any)?.content || "");
            bumpTitle(1);
          }
        }
        return;
      }

      if (type === "typing_indicator" || type === "typing") {
        const uid = packet.user_id ?? packet.userId ?? packet.sender_id ?? null;

        const rid = toNum(packet.room_id ?? packet.roomId ?? packet.chat_room_id ?? null);

        if (roomIdNum && rid && rid !== roomIdNum) return;
        if (!uid) return;

        const isTyping = Boolean(packet.isTyping);

        if (!isTyping) {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
          dispatch(resetTypingIndicator(uid));
          setTypingUserId(null);
          return;
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setTypingUserId(uid);

        typingTimeoutRef.current = setTimeout(() => {
          dispatch(resetTypingIndicator(uid));
          setTypingUserId(null);
          typingTimeoutRef.current = null;
        }, 3500);
      }
    },
    [dispatch, currentUserId, notifyNewMessage, showDesktopNotification, bumpTitle, roomIdNum]
  );

  useEffect(() => {
    if (typeof registerIncoming !== "function") {
      console.log(ROOM_TAG, "registerIncoming is NOT a function -> realtime will not arrive");
      return;
    }

    console.log(ROOM_TAG, "registerIncoming attached ✅");
    const unsub = registerIncoming(handleIncoming);

    return () => {
      console.log(ROOM_TAG, "registerIncoming detached");
      try {
        (unsub as any)?.();
      } catch {}
    };
  }, [registerIncoming, handleIncoming]);

  useEffect(() => {
    if (transportStatus === "connected") {
      setTimeout(() => inputRef.current?.focus?.(), 0);
    }
  }, [transportStatus, roomIdNum]);

  /* -------------------- send message (HTTP only) -------------------- */
  const readyToSend =
    Boolean(roomIdNum) && Number.isFinite(Number(currentUserId)) && transportStatus === "connected";

  const handleSendMessage = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const text = String(messageInput || "").trim();
      setUiError(null);

      if (!currentUserId) return setUiError("User not ready yet.");
      if (!text) return setUiError("Message cannot be empty");
      if (transportStatus !== "connected") return setUiError("Realtime is not connected yet.");

      try {
        sendTyping?.({ roomId: roomIdNum as number, isTyping: false });

        if (!sendUrl) throw new Error("sendUrl is missing");
        await (apiClient as any).post(sendUrl, { text, kind: null });

        setMessageInput("");
        setTimeout(() => scrollToBottom("smooth"), 0);
      } catch (e2: any) {
        console.error(ROOM_TAG, "sendMessage failed", e2);
        setUiError(e2?.message || "Failed to send message");
      }
    },
    [messageInput, transportStatus, roomIdNum, currentUserId, scrollToBottom, sendUrl, sendTyping]
  );

  /* -------------------- typing (UI throttle) -------------------- */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setMessageInput(val);

      if (!currentUserId) return;
      if (!roomIdNum) return;
      if (transportStatus !== "connected") return;

      if (!val.trim()) {
        sendTyping?.({ roomId: roomIdNum, isTyping: false });
        return;
      }

      const now = Date.now();
      if (now - lastTypingUiAtRef.current < 800) return;
      lastTypingUiAtRef.current = now;

      sendTyping?.({ roomId: roomIdNum, isTyping: true });
    },
    [currentUserId, roomIdNum, transportStatus, sendTyping]
  );

  /* -------------------- render -------------------- */
  if (!roomIdNum) return <SelectRoomPlaceholder />;
  if (!currentUserId) return <div>Loading user...</div>;

  return (
    <div className="chat-window chat-window--full">
      {loading && (
        <div className="loading-spinner">
          <Spinner animation="border" />
        </div>
      )}

      {uiError && <Alert variant="danger">{uiError}</Alert>}

      <div className="connection-status">
        {connectionLabel || "—"}
        <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 8 }}>
          {ROOM_TAG} roomId={roomIdNum} backend={String(effectiveKind)} status={transportStatus}
        </span>
      </div>

      <div className="chat-window__body">
        <div className="chat-window__messagesWrap">
          <ChatMessagesList
            messages={messages}
            currentUserId={currentUserId}
            containerRef={containerRef}
          />

          {showNewBadge && (
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="chat-window__newBadge"
            >
              New messages ({newCount})
            </button>
          )}
        </div>

        <TypingIndicator typing={typingUserId} />

        <Form onSubmit={handleSendMessage} className="chat-input-form">
          <Form.Group controlId="messageInput">
            <Form.Control
              ref={inputRef}
              type="text"
              placeholder={currentUserId ? "Type a message..." : "Loading user…"}
              value={messageInput}
              onChange={handleInputChange}
              disabled={!currentUserId || transportStatus !== "connected"}
              onBlur={() => sendTyping?.({ roomId: roomIdNum, isTyping: false })}
            />
          </Form.Group>

          <Button type="submit" variant="primary" disabled={!readyToSend || !messageInput.trim()}>
            Send
          </Button>
        </Form>
      </div>
    </div>
  );
}