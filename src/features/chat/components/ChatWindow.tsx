// chatApp-frontend\src\features\chat\components\ChatWindow.tsx
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

/* ----------------------------- types ----------------------------- */

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
  [k: string]: any;
};

export type RegisterIncomingFn = (handler: (packet: IncomingPacket) => void) => void | (() => void);

type ChatWindowProps = {
  roomId: number | string | null;
  effectiveKind: string;
  accessToken?: string | null;

  transportStatus?: TransportStatus;
  sendTyping?: SendTypingFn;
  registerIncoming?: RegisterIncomingFn | null;
};

/* ----------------------------- helpers ----------------------------- */

const TAG = "[ChatWindow]";
const isJwt = (t: unknown): t is string => typeof t === "string" && t.split(".").length === 3;

const stripBearer = (t: unknown): string =>
  String(t || "").replace(/^Bearer\s+/i, "").trim();

const toNum = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

type NormalizedMsg = ChatMessage & {
  sender_id?: number | string | null;
  user_id?: number | string | null;
  room_id?: number | string | null;
  chat_room_id?: number | string | null;
};

const norm = (raw: any): NormalizedMsg => {
  if (!raw || typeof raw !== "object") return raw;
  const id = raw.id ?? raw.message_id ?? null;
  const rid = raw.room_id ?? raw.chat_room_id ?? raw.roomId ?? null;
  const uid = raw.user_id ?? raw.sender_id ?? raw.userId ?? null;
  return {
    ...raw,
    id,
    room_id: rid,
    chat_room_id: rid,
    user_id: uid,
    sender_id: uid,
    content: raw.content ?? raw.text ?? raw.message ?? raw.body ?? null,
    created_at: raw.created_at ?? raw.createdAt ?? raw.ts ?? raw.timestamp ?? null,
  };
};

const canceled = (e: any) =>
  e?.code === "ERR_CANCELED" ||
  e?.name === "CanceledError" ||
  e?.name === "AbortError" ||
  String(e?.message || "").toLowerCase().includes("canceled");

/* ----------------------------- UI ----------------------------- */

const Placeholder = () => (
  <div className="no-chat-selected">
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 800 }}>هیچ گفتگویی انتخاب نشده</div>
      <div style={{ marginTop: 8, opacity: 0.8 }}>از لیست سمت چپ یک گفتگو را انتخاب کن.</div>
    </div>
  </div>
);

/* ----------------------------- component ----------------------------- */

export default function ChatWindow({
  roomId,
  effectiveKind,
  accessToken: tokenProp,
  transportStatus: tsProp = "connected",
  sendTyping = () => false,
  registerIncoming = null,
}: ChatWindowProps) {
  const dispatch = useAppDispatch();
  const uidFromStore = useAppSelector(selectCurrentUserId);

  const token = stripBearer(tokenProp || "");
  const rid = useMemo(() => toNum(roomId), [roomId]);
  const url = useMemo(() => (rid ? `/chat/messages/${rid}/` : null), [rid]);

  const [msgs, setMsgs] = useState<NormalizedMsg[]>([]);
  const [txt, setTxt] = useState("");
  const [uiErr, setUiErr] = useState<string | null>(null);
  const [typingUid, setTypingUid] = useState<number | string | null>(null);
  const [me, setMe] = useState<number | null>(toNum(uidFromStore));
  const [loading, setLoading] = useState(false);

  const seen = useRef<Set<any>>(new Set());
  const typingT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNotifyAt = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wasTypingRef = useRef(false);

  const { bump } = useDocTitleBadge();
  const { containerRef, notifyNewMessage, scrollToBottom, showNewBadge, newCount } =
    useAutoScroll({ enabled: true, bottomThresholdPx: 140 });

  const showDeskNotif = useCallback((title: string, body: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!document.hidden) return;
    try {
      new Notification(title, { body });
    } catch {}
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    audioRef.current = new Audio("/sounds/incoming.mp3");
  }, []);

  /* user id */
  useEffect(() => {
    const s = toNum(uidFromStore);
    if (s) return void setMe(s);

    if (isJwt(token)) {
      try {
        const dec: any = jwtDecode(token);
        const id = dec?.user_id ?? dec?.sub ?? null;
        if (id) setMe(Number(id));
      } catch {}
    }
  }, [uidFromStore, token]);

  useEffect(() => {
    if (me || !token) return;
    let dead = false;
    (async () => {
      try {
        const x: any = await (http as any).get("/auth/me");
        if (!dead && x?.id) setMe(Number(x.id));
      } catch {}
    })();
    return () => void (dead = true);
  }, [me, token]);

  /* reset on room change */
  useEffect(() => {
    setMsgs([]);
    setTxt("");
    setUiErr(null);
    setTypingUid(null);
    seen.current = new Set();
    wasTypingRef.current = false;

    if (typingT.current) clearTimeout(typingT.current);
    typingT.current = null;

    setTimeout(() => scrollToBottom("auto"), 0);
    console.log(TAG, "ROOM RESET", { roomId, rid, url });
  }, [roomId, rid, url, scrollToBottom]);

  /* history */
  useEffect(() => {
    if (!rid || !url) return;

    setLoading(true);
    setUiErr(null);

    const c = (http as any)?.cancelable?.get?.(url);
    if (!c?.promise || !c?.cancel) {
      setLoading(false);
      return void setUiErr("Internal error: cancelable HTTP not available.");
    }

    const { promise, cancel } = c;

    promise
      .then((data: any) => {
        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.messages)
            ? data.messages
            : data?.data || [];

        const normalized = (arr as any[]).map(norm).filter((m) => m?.id != null);
        seen.current = new Set(normalized.map((m) => m.id));
        setMsgs(normalized);
        setTimeout(() => scrollToBottom("auto"), 0);
      })
      .catch((e: any) => !canceled(e) && setUiErr("Error fetching messages. Please try again."))
      .finally(() => setLoading(false));

    return () => cancel();
  }, [rid, url, scrollToBottom]);

  /* incoming realtime */
  const onIncoming = useCallback(
    (p: IncomingPacket) => {
      if (!p) return;
      const type = p.type || (p.message ? "message" : "message");

      if (type === "message") {
        const m = norm(p.message ?? p);
        const pr = toNum(m.room_id ?? m.chat_room_id);
        if (rid && pr && pr !== rid) return;

        if (m?.id && !seen.current.has(m.id)) {
          seen.current.add(m.id);
          setMsgs((x) => [...x, m]);
          notifyNewMessage();
        }

        dispatch(updateMessages({ type: "message", room_id: pr ?? rid, message: m }));

        const sid = (m as any)?.sender_id;
        if (sid && me && Number(sid) !== Number(me)) {
          const now = Date.now();
          if (now - lastNotifyAt.current > 1200) {
            lastNotifyAt.current = now;
            const body = (m as any)?.content ?? "پیام جدید";
            toast?.info(body);
            audioRef.current?.play().catch(() => {});
            showDeskNotif("پیام جدید", String(body || ""));
            bump(1);
          }
        }
        return;
      }

      if (type === "typing_indicator" || type === "typing") {
        const uid = p.user_id ?? p.userId ?? p.sender_id ?? null;
        const pr = toNum(p.room_id ?? p.roomId ?? p.chat_room_id ?? null);
        if (rid && pr && pr !== rid) return;
        if (!uid) return;

        if (!p.isTyping) {
          if (typingT.current) clearTimeout(typingT.current);
          typingT.current = null;
          dispatch(resetTypingIndicator(uid));
          return void setTypingUid(null);
        }

        if (typingT.current) clearTimeout(typingT.current);
        setTypingUid(uid);
        typingT.current = setTimeout(() => {
          dispatch(resetTypingIndicator(uid));
          setTypingUid(null);
          typingT.current = null;
        }, 3500);
      }
    },
    [dispatch, me, rid, notifyNewMessage, showDeskNotif, bump]
  );

  useEffect(() => {
    if (typeof registerIncoming !== "function") return;
    const unsub = registerIncoming(onIncoming);
    return () => {
      try {
        (unsub as any)?.();
      } catch {}
    };
  }, [registerIncoming, onIncoming]);

  useEffect(() => {
    if (tsProp === "connected") setTimeout(() => inputRef.current?.focus?.(), 0);
  }, [tsProp, rid]);

  /* send */
  const ready = Boolean(rid) && Boolean(me) && tsProp === "connected";

  const send = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const text = String(txt || "").trim();
      setUiErr(null);

      if (!me) return setUiErr("User not ready yet.");
      if (!text) return setUiErr("Message cannot be empty");

      if (rid && wasTypingRef.current) {
        wasTypingRef.current = false;
        sendTyping?.({ roomId: rid, isTyping: false });
      }

      try {
        if (!url) throw new Error("sendUrl missing");

        const res: any = await (apiClient as any).post(url, { text, kind: null });

        const rawMsg = res?.message ?? res?.data?.message ?? null;
        const localMsg = rawMsg ? norm(rawMsg) : null;

        if (localMsg?.id != null && !seen.current.has(localMsg.id)) {
          seen.current.add(localMsg.id);
          setMsgs((prev) => [...prev, localMsg]);
          notifyNewMessage();
        }

        if (localMsg) {
          dispatch(
            updateMessages({
              type: "message",
              room_id: rid,
              message: localMsg,
            })
          );
        }

        setTxt("");
        setTimeout(() => scrollToBottom("smooth"), 0);
      } catch (e2: any) {
        setUiErr(e2?.message || "Failed to send message");
      }
    },
    [txt, me, rid, url, sendTyping, scrollToBottom, dispatch, notifyNewMessage]
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setTxt(v);

      if (!me || !rid || tsProp !== "connected") return;

      const typing = Boolean(v.trim());
      if (wasTypingRef.current === typing) return;
      wasTypingRef.current = typing;

      sendTyping?.({ roomId: rid, isTyping: typing });
    },
    [me, rid, tsProp, sendTyping]
  );

  if (!rid) return <Placeholder />;
  if (!me) return <div>Loading user...</div>;

  return (
    <div className="chat-window chat-window--full">
      {loading && (
        <div className="loading-spinner">
          <Spinner animation="border" />
        </div>
      )}

      {uiErr && <Alert variant="danger">{uiErr}</Alert>}

      <div className="chat-window__body">
        <div className="chat-window__messagesWrap">
          <ChatMessagesList messages={msgs} currentUserId={me} containerRef={containerRef} />

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

        <TypingIndicator typing={typingUid} />

        <Form onSubmit={send} className="chat-input-form">
          <Form.Group controlId="messageInput">
            <Form.Control
              ref={inputRef}
              type="text"
              placeholder="Type a message..."
              value={txt}
              onChange={onChange}
              disabled={!ready}
              onBlur={() => {
                if (!rid || tsProp !== "connected") return;
                if (!wasTypingRef.current) return;
                wasTypingRef.current = false;
                sendTyping?.({ roomId: rid, isTyping: false });
              }}
            />
          </Form.Group>

          <Button type="submit" variant="primary" disabled={!ready || !txt.trim()}>
            Send
          </Button>
        </Form>

        <div style={{ opacity: 0.55, fontSize: 11, marginTop: 6 }}>
          {TAG} roomId={rid} backend={String(effectiveKind)} status={String(tsProp)}
        </div>
      </div>
    </div>
  );
}