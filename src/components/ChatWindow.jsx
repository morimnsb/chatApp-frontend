// src/components/ChatWindow.js
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import { jwtDecode } from 'jwt-decode';
import useFetch from '@/hooks/useFetch';
import { resetTypingIndicator, updateMessages } from '@/actions/messageActions';
import { formatTime } from '@/utils/formatTime';
import profilephoto1 from '@/assets/images/message/profilephoto1.png';
import { toast } from 'react-toastify';

// ⭐ فقط این هوک برای WS استفاده می‌شود
import useRoomTransport from '@/hooks/useRoomTransport';

const isJwt = (t) => typeof t === 'string' && t.split('.').length === 3;
const stripBearer = (t) => (t || '').toString().replace(/^Bearer\s+/i, '');

// ✅ لاگ‌ها کم و قابل کنترل
const ROOM_DEBUG = '[ChatWindow]';
const DEBUG = Boolean(import.meta.env.VITE_WS_DEBUG) && import.meta.env.DEV;
const dlog = (...args) => DEBUG && console.log(...args);
const dwarn = (...args) => DEBUG && console.warn(...args);
const derr = (...args) => DEBUG && console.error(...args);

const MessageBubble = React.memo(({ message, currentUserId }) => (
  <div className="message-bubble">
    {message.sender_first_name && (
      <div className="chat-header-details">
        <img
          src={message.photo || profilephoto1}
          alt={message.sender_first_name}
          className="chat-header-img"
        />
        <div className="chat-header-info">
          <h4>{message.sender_first_name}</h4>
        </div>
      </div>
    )}
    <div className="message-text">
      {message.content}
      <span className="message-time">
        {formatTime(message.timestamp || message.created_at)}
      </span>
      {message.sender_id === currentUserId && (
        <span className={`read_receipt ${message.read_receipt ? 'read' : ''}`}>
          ✓✓
        </span>
      )}
    </div>
  </div>
));

const MessageList = React.memo(({ messages, currentUserId }) => (
  <div className="messages">
    {Array.isArray(messages) && messages.length ? (
      messages.map((m) => (
        <MessageBubble key={m.id} message={m} currentUserId={currentUserId} />
      ))
    ) : (
      <div className="no-messages">No messages yet</div>
    )}
  </div>
));

const TypingIndicator = ({ typing }) =>
  typing && <div className="typing-indicator">User is typing...</div>;

const ChatWindow = ({ roomId, endpoints, effectiveKind, accessToken: accessTokenProp }) => {
  const dispatch = useDispatch();

  const currentUserFromStore = useSelector(
    (s) => s.auth?.currentUser?.id || s.messages?.currentUserId || null,
  );

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [currentUserId, setCurrentUserId] = useState(currentUserFromStore || null);

  const seenMessageIdsRef = useRef(new Set());
  const timeoutRef = useRef(null);
  const notifyAudioRef = useRef(null);
  const lastNotifyAtRef = useRef(0);
  const lastTypingAtRef = useRef(0); // ✅ جلوگیری از spam تایپینگ در UI
  const originalTitleRef = useRef(document.title);

  const rawToken = accessTokenProp || '';
  const accessToken = stripBearer(rawToken);

  /* -------------------- Desktop notify & title -------------------- */

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    notifyAudioRef.current = new Audio('/sounds/incoming.mp3');
  }, []);

  const showDesktopNotification = useCallback((title, body, onClick) => {
    if (Notification?.permission === 'granted' && document.hidden) {
      const n = new Notification(title, { body });
      if (onClick) {
        n.onclick = (e) => {
          e.preventDefault();
          window.focus();
          onClick();
          n.close();
        };
      }
    }
  }, []);

  useEffect(() => {
    const onVisChange = () => {
      if (!document.hidden) document.title = originalTitleRef.current;
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, []);

  const bumpTitle = (count = 1) => {
    document.title = `( ${count} ) ${originalTitleRef.current}`;
  };

  /* -------------------- currentUserId از Redux/JWT/ /me -------------------- */

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
          dlog(ROOM_DEBUG, 'currentUserId from JWT', Number(id));
        }
      } catch (e) {
        dwarn(ROOM_DEBUG, 'JWT decode skipped:', e?.message);
      }
    }
  }, [currentUserFromStore, accessToken]);

  useEffect(() => {
    const needFetchMe = !currentUserId && !!accessToken && endpoints?.me;
    if (!needFetchMe) return;

    let abort = false;
    (async () => {
      try {
        dlog(ROOM_DEBUG, 'fetching /me', endpoints.me);
        const resp = await fetch(endpoints.me, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) throw new Error(`GET /me ${resp.status}`);
        const me = await resp.json().catch(() => ({}));
        if (!abort && me?.id) {
          setCurrentUserId(Number(me.id));
          dlog(ROOM_DEBUG, 'currentUserId from /me', Number(me.id));
        }
      } catch (e) {
        dwarn(ROOM_DEBUG, '[me] fallback failed:', e?.message);
      }
    })();

    return () => {
      abort = true;
    };
  }, [currentUserId, accessToken, endpoints]);

  /* -------------------- گرفتن پیام‌ها (HTTP فقط برای history) -------------------- */

  const fetchConfig = useMemo(
    () => (roomId ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
    [roomId, accessToken],
  );

  const { data: fetchedMessages, loading, error: fetchError } = useFetch(
    roomId && endpoints?.roomMessages ? endpoints.roomMessages(roomId) : null,
    fetchConfig,
  );

  useEffect(() => {
    if (!fetchedMessages) return;

    let arr = [];
    if (Array.isArray(fetchedMessages)) arr = fetchedMessages;
    else if (Array.isArray(fetchedMessages.messages)) arr = fetchedMessages.messages;
    else if (Array.isArray(fetchedMessages.data)) arr = fetchedMessages.data;

    // ✅ history رو بی‌سروصدا ست می‌کنیم + seen را پر می‌کنیم (اختیاری)
    const seen = new Set();
    for (const m of arr) if (m?.id) seen.add(m.id);
    seenMessageIdsRef.current = seen;

    setMessages(arr);
    dlog(ROOM_DEBUG, 'history loaded', { count: arr.length });
  }, [fetchedMessages]);

  useEffect(() => {
    if (!fetchError) return;
    derr(ROOM_DEBUG, 'Error fetching messages:', fetchError);
    setError('Error fetching messages. Please try again.');
  }, [fetchError]);

  /* -------------------- handler مشترک برای تمام packetها -------------------- */

  const handleNotification = useCallback(
    (packet) => {
      if (!packet || !packet.type) {
        dwarn(ROOM_DEBUG, 'packet without type ignored', packet);
        return;
      }

      switch (packet.type) {
        case 'message': {
          const m = packet.message;

          if (m?.id && !seenMessageIdsRef.current.has(m.id)) {
            seenMessageIdsRef.current.add(m.id);
            setMessages((prev) => [...prev, m]);
          }

          dispatch(updateMessages(packet));

          // نوتیف فقط وقتی از دیگری باشد
          if (m?.sender_id && currentUserId && m.sender_id !== currentUserId) {
            try {
              const now = Date.now();
              if (now - lastNotifyAtRef.current > 1200) {
                lastNotifyAtRef.current = now;
                toast?.info(m.content ?? 'پیام جدید');
                notifyAudioRef.current?.play().catch(() => {});
                showDesktopNotification(m.sender_name || 'پیام جدید', m.content || '', () => {});
                if (document.hidden) bumpTitle();
              }
            } catch (e) {
              dwarn(ROOM_DEBUG, 'notification error', e);
            }
          }
          break;
        }

        case 'typing_indicator': {
          if (packet.user_id) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setTyping(packet.user_id);
            timeoutRef.current = setTimeout(() => {
              dispatch(resetTypingIndicator(packet.user_id));
              setTyping(null);
            }, 5000);
          }
          break;
        }

        case 'message_received': {
          setMessages((prev) =>
            prev.map((x) =>
              x.id === packet.message ? { ...x, read_receipt: true } : x,
            ),
          );
          break;
        }

        default:
          dlog(ROOM_DEBUG, 'Unknown WS type:', packet.type);
      }
    },
    [dispatch, currentUserId, showDesktopNotification],
  );

  /* -------------------- ترنسپورت یکپارچه (Django + Reverb) -------------------- */

  const { status: transportStatus, connectionLabel, sendMessage, sendTyping } =
    useRoomTransport({
      backendKind: effectiveKind,
      roomId,
      accessToken,
      handleNotification,
      currentUserId,
    });

  useEffect(() => {
    setConnectionStatus(connectionLabel || '—');
    dlog(ROOM_DEBUG, 'transport', { status: transportStatus, label: connectionLabel });
  }, [connectionLabel, transportStatus]);

  /* -------------------- ارسال پیام (فقط WebSocket) -------------------- */

  const handleSendMessage = useCallback(
    async (e) => {
      e.preventDefault();
      const text = messageInput.trim();
      dlog(ROOM_DEBUG, 'SUBMIT', {
  roomId,
  currentUserId,
  transportStatus,
  textLen: messageInput.trim().length,
});

if (!currentUserId) {
  setError('User not ready yet (loading /me). Try again in 1 second.');
  return;
}

      if (!text) {
        setError('Message cannot be empty');
        return;
      }

      try {
        if (
          transportStatus === 'off' ||
          transportStatus === 'closed' ||
          transportStatus === 'disconnected' ||
          transportStatus === 'error'
        ) {
          setError('WebSocket connection is not open. Please try again later.');
          return;
        }

        await sendMessage(text);

        setMessageInput('');
        setError(null);
      } catch (err) {
        derr(ROOM_DEBUG, 'Error sending message (WS):', err);
        setError(err?.message || 'Failed to send message');
      }
    },
    [messageInput, sendMessage, transportStatus],
  );

  /* -------------------- تایپینگ (کم‌لاگ + throttle UI) -------------------- */

  const handleInputChange = useCallback(
    (e) => {
      const val = e.target.value;
      setMessageInput(val);

      if (!currentUserId) return;
      if (!val.trim()) return;

      // ✅ UI-side throttle: هر 800ms یک بار تلاش کنیم
      const now = Date.now();
      if (now - lastTypingAtRef.current < 800) return;
      lastTypingAtRef.current = now;

      // sendTyping خودش throttle دارد (تو useRoomTransport)
      const sent = sendTyping(currentUserId);
      if (sent) dlog(ROOM_DEBUG, 'typing sent', { roomId, userId: currentUserId });
    },
    [currentUserId, sendTyping, roomId],
  );

  if (!roomId) {
    return <div className="no-chat-selected">Select a chat to start messaging</div>;
  }
const readyToSend =
  Boolean(roomId) &&
  Boolean(accessToken) &&
  Number.isFinite(Number(currentUserId)) &&
  transportStatus === 'connected';

  return (
    <div className="chat-window">
      {loading && (
        <div className="loading-spinner">
          <Spinner animation="border" />
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="connection-status">
        {connectionStatus}{' '}
        {DEBUG && (
          <span style={{ opacity: 0.6, fontSize: 11 }}>
            ({ROOM_DEBUG} roomId={roomId}, backend={String(effectiveKind)})
          </span>
        )}
      </div>

      <MessageList messages={messages} currentUserId={currentUserId} />
      <TypingIndicator typing={typing} />

      <Form onSubmit={handleSendMessage} className="chat-input-form">
  <Form.Group controlId="messageInput">
    <Form.Control
      type="text"
      placeholder={currentUserId ? 'Type a message...' : 'Loading user…'}
      value={messageInput}
      onChange={handleInputChange}
      disabled={!currentUserId || transportStatus !== 'connected'}
    />
  </Form.Group>

  <Button
    type="submit"
    variant="primary"
    disabled={!readyToSend || !messageInput.trim()}
  >
    Send
  </Button>
</Form>



    </div>
  );
};

export default ChatWindow;
