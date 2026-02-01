import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';

import useFetch from '@/shared/hooks/useFetch';
import useRoomTransport from '@/features/chat/hooks/useRoomTransport.js';

import { resetTypingIndicator, updateMessages } from '@/features/chat/state/messageActions';

import ChatMessagesList from '@/features/chat/components/ChatMessagesList.jsx';
import TypingIndicator from '@/features/chat/components/TypingIndicator.jsx';

import { useAutoScroll } from '@/features/chat/hooks/useAutoScroll.js';
import { useDocTitleBadge } from '@/features/chat/hooks/useDocTitleBadge.js';

/* ----------------------------- helpers ----------------------------- */

const ROOM_TAG = '[ChatWindow]';
const DEV = import.meta.env.DEV === true;
const DEBUG_LEVEL = DEV ? Number(import.meta.env.VITE_WS_DEBUG_LEVEL || 0) : 0;

const log = (lvl, ...args) => DEBUG_LEVEL >= lvl && console.log(...args);
const warn = (...args) => DEBUG_LEVEL >= 1 && console.warn(...args);
const err = (...args) => DEBUG_LEVEL >= 1 && console.error(...args);

const isJwt = (t) => typeof t === 'string' && t.split('.').length === 3;
const stripBearer = (t) => (t || '').toString().replace(/^Bearer\s+/i, '').trim();

/* ✅ Only show a message (no previous room UI) */
function SelectRoomPlaceholder() {
  return (
    <div className="no-chat-selected">
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>هیچ گفتگویی انتخاب نشده</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>از لیست سمت چپ یک گفتگو را انتخاب کن.</div>
      </div>
    </div>
  );
}

export default function ChatWindow({
  roomId,
  endpoints,
  effectiveKind,
  accessToken: accessTokenProp,
}) {
  const dispatch = useDispatch();

  const currentUserFromStore = useSelector(
    (s) => s.auth?.currentUser?.id || s.messages?.currentUserId || null,
  );

  const rawToken = accessTokenProp || '';
  const accessToken = stripBearer(rawToken);

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [uiError, setUiError] = useState(null);
  const [typingUserId, setTypingUserId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(currentUserFromStore || null);

  const seenMessageIdsRef = useRef(new Set());
  const typingTimeoutRef = useRef(null);

  const lastNotifyAtRef = useRef(0);
  const lastTypingUiAtRef = useRef(0);
  const notifyAudioRef = useRef(null);

  const inputRef = useRef(null);

  const { bump: bumpTitle } = useDocTitleBadge();

  const { containerRef, notifyNewMessage, scrollToBottom, showNewBadge, newCount } =
    useAutoScroll({ enabled: true, bottomThresholdPx: 140 });

  /* -------------------- ✅ HARD RESET when room changes -------------------- */
  useEffect(() => {
    // وقتی روم عوض شد: هیچ چیزی از روم قبلی نباید باقی بماند
    setMessages([]);
    setMessageInput('');
    setUiError(null);
    setTypingUserId(null);

    seenMessageIdsRef.current = new Set();

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = null;

    // این باعث میشه badge های "new messages" هم از اول شروع بشن
    setTimeout(() => scrollToBottom('auto'), 0);

    log(2, ROOM_TAG, 'room changed -> cleared local chat state', { roomId });
  }, [roomId, scrollToBottom]);

  /* -------------------- notifications init -------------------- */
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    notifyAudioRef.current = new Audio('/sounds/incoming.mp3');
  }, []);

  const showDesktopNotification = useCallback((title, body) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!document.hidden) return;

    try {
      new Notification(title, { body });
    } catch {}
  }, []);

  /* -------------------- currentUserId from store/JWT//me -------------------- */
  useEffect(() => {
    if (currentUserFromStore) {
      setCurrentUserId(currentUserFromStore);
      return;
    }

    if (isJwt(accessToken)) {
      try {
        const dec = jwtDecode(accessToken);
        const id = dec?.user_id ?? dec?.sub ?? null;
        if (id) {
          setCurrentUserId(Number(id));
          log(2, ROOM_TAG, 'currentUserId from JWT', Number(id));
        }
      } catch (e) {
        warn(ROOM_TAG, 'JWT decode skipped:', e?.message);
      }
    }
  }, [currentUserFromStore, accessToken]);

  useEffect(() => {
    const needFetchMe = !currentUserId && !!accessToken && endpoints?.me;
    if (!needFetchMe) return;

    let abort = false;

    (async () => {
      try {
        log(2, ROOM_TAG, 'fetching /me', endpoints.me);
        const resp = await fetch(endpoints.me, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) throw new Error(`GET /me ${resp.status}`);
        const me = await resp.json().catch(() => ({}));

        if (!abort && me?.id) {
          setCurrentUserId(Number(me.id));
          log(2, ROOM_TAG, 'currentUserId from /me', Number(me.id));
        }
      } catch (e) {
        warn(ROOM_TAG, '[me] failed:', e?.message);
      }
    })();

    return () => {
      abort = true;
    };
  }, [currentUserId, accessToken, endpoints]);

  /* -------------------- history fetch (HTTP) -------------------- */
  const fetchConfig = useMemo(
    () => (roomId ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
    [roomId, accessToken],
  );

  const { data: fetchedMessages, loading, error: fetchError } = useFetch(
    roomId && endpoints?.roomMessages ? endpoints.roomMessages(roomId) : null,
    fetchConfig,
  );

  useEffect(() => {
    if (!roomId) return;
    if (!fetchedMessages) return;

    let arr = [];
    if (Array.isArray(fetchedMessages)) arr = fetchedMessages;
    else if (Array.isArray(fetchedMessages?.messages)) arr = fetchedMessages.messages;
    else if (Array.isArray(fetchedMessages?.data)) arr = fetchedMessages.data;

    const seen = new Set();
    for (const m of arr) if (m?.id) seen.add(m.id);
    seenMessageIdsRef.current = seen;

    setMessages(arr);

    setTimeout(() => scrollToBottom('auto'), 0);
    log(2, ROOM_TAG, 'history loaded', { roomId, count: arr.length });
  }, [roomId, fetchedMessages, scrollToBottom]);

  useEffect(() => {
    if (!fetchError) return;
    err(ROOM_TAG, 'Error fetching messages:', fetchError);
    setUiError('Error fetching messages. Please try again.');
  }, [fetchError]);

  /* -------------------- WS notification handler -------------------- */
  const handleNotification = useCallback(
    (packet) => {
      if (!packet || !packet.type) return;

      if (packet.type === 'message') {
        const m = packet.message;

        if (m?.id && !seenMessageIdsRef.current.has(m.id)) {
          seenMessageIdsRef.current.add(m.id);

          setMessages((prev) => [...prev, m]);
          notifyNewMessage();
        }

        dispatch(updateMessages(packet));

        const senderId = m?.sender_id;
        const mine = Number(currentUserId);

        if (senderId && mine && Number(senderId) !== mine) {
          const now = Date.now();
          if (now - lastNotifyAtRef.current > 1200) {
            lastNotifyAtRef.current = now;

            toast?.info(m?.content ?? 'پیام جدید');
            notifyAudioRef.current?.play().catch(() => {});
            showDesktopNotification(m?.sender_name || 'پیام جدید', m?.content || '');

            bumpTitle(1);
          }
        }

        return;
      }

      if (packet.type === 'typing_indicator') {
        const uid = packet.user_id;
        if (!uid) return;

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        setTypingUserId(uid);

        typingTimeoutRef.current = setTimeout(() => {
          dispatch(resetTypingIndicator(uid));
          setTypingUserId(null);
          typingTimeoutRef.current = null;
        }, 5000);

        return;
      }

      if (packet.type === 'message_received') {
        setMessages((prev) =>
          prev.map((x) => (x?.id === packet.message ? { ...x, read_receipt: true } : x)),
        );
      }
    },
    [dispatch, currentUserId, notifyNewMessage, showDesktopNotification, bumpTitle],
  );

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    };
  }, [roomId]);

  /* -------------------- transport -------------------- */
  const { status: transportStatus, connectionLabel, sendMessage, sendTyping } =
    useRoomTransport({
      backendKind: effectiveKind,
      roomId,
      accessToken,
      handleNotification,
      currentUserId,
    });

  useEffect(() => {
    if (transportStatus === 'connected') {
      setTimeout(() => inputRef.current?.focus?.(), 0);
    }
  }, [transportStatus, roomId]);

  /* -------------------- send message -------------------- */
  const readyToSend =
    Boolean(roomId) &&
    Boolean(accessToken) &&
    Number.isFinite(Number(currentUserId)) &&
    transportStatus === 'connected';

  const handleSendMessage = useCallback(
    async (e) => {
      e.preventDefault();

      const text = String(messageInput || '').trim();
      setUiError(null);

      log(2, ROOM_TAG, 'SUBMIT', { roomId, currentUserId, transportStatus, textLen: text.length });

      if (!currentUserId) {
        setUiError('User not ready yet (loading /me). Try again in 1 second.');
        return;
      }

      if (!text) {
        setUiError('Message cannot be empty');
        return;
      }

      if (transportStatus !== 'connected') {
        setUiError('WebSocket is not connected yet.');
        return;
      }

      try {
        await sendMessage(text);
        setMessageInput('');
        setTimeout(() => scrollToBottom('smooth'), 0);
      } catch (e2) {
        err(ROOM_TAG, 'sendMessage failed', e2);
        setUiError(e2?.message || 'Failed to send message');
      }
    },
    [messageInput, sendMessage, transportStatus, roomId, currentUserId, scrollToBottom],
  );

  /* -------------------- typing (UI throttle) -------------------- */
  const handleInputChange = useCallback(
    (e) => {
      const val = e.target.value;
      setMessageInput(val);

      if (!currentUserId) return;
      if (!val.trim()) return;

      const now = Date.now();
      if (now - lastTypingUiAtRef.current < 800) return;
      lastTypingUiAtRef.current = now;

      sendTyping(currentUserId);
    },
    [currentUserId, sendTyping],
  );

  /* -------------------- render -------------------- */
  if (!roomId) {
    return <SelectRoomPlaceholder />;
  }
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
        {connectionLabel || '—'}
        {DEBUG_LEVEL > 0 && (
          <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 8 }}>
            {ROOM_TAG} roomId={roomId} backend={String(effectiveKind)} status={transportStatus}
          </span>
        )}
      </div>

      <div className="chat-window__body">
        <div className="chat-window__messagesWrap">
          {/* ✅ DEBUG PANEL */}
{import.meta.env.DEV && (
  <div style={{ padding: 8, fontSize: 12, opacity: 0.85 }}>
    <div><b>roomId:</b> {roomId}</div>
    <div><b>currentUserId:</b> {String(currentUserId)}</div>
    <div><b>messages.length:</b> {messages?.length ?? 0}</div>
    <div><b>sample:</b> {messages?.[0] ? JSON.stringify(messages[0]).slice(0, 220) + '…' : '—'}</div>
  </div>
)}

          <ChatMessagesList
  messages={messages}
  currentUserId={currentUserId}
  containerRef={containerRef}
/>


          {showNewBadge && (
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
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
              placeholder={currentUserId ? 'Type a message...' : 'Loading user…'}
              value={messageInput}
              onChange={handleInputChange}
              disabled={!currentUserId || transportStatus !== 'connected'}
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







