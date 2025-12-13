// ChatWindow.js
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import { jwtDecode } from 'jwt-decode';
import useFetch from '../hooks/useFetch';
import useChatWebSocket from '../hooks/useChatWebSocket';
import {
  resetTypingIndicator,
  updateMessages,
} from '../actions/messageActions';
import { formatTime } from '../utils/formatTime';
import profilephoto1 from '../assets/images/message/profilephoto1.png';
import { toast } from 'react-toastify';

const isJwt = (t) => typeof t === 'string' && t.split('.').length === 3;
const stripBearer = (t) => (t || '').toString().replace(/^Bearer\s+/i, '');

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

function buildWsUrlForDjango(roomId, token) {
  const base = (
    process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws/chat/'
  ).replace(/\/+$/, '');
  const tokenParam = isJwt(token) ? `?token=${encodeURIComponent(token)}` : '';
  return `${base}/${roomId}/${tokenParam}`;
}

const ChatWindow = ({ roomId, endpoints, effectiveKind }) => {
  const dispatch = useDispatch();
  const IS_DJANGO = String(effectiveKind || '').toLowerCase() === 'django';

  const currentUserFromStore = useSelector(
    (s) => s.auth?.currentUser?.id || s.messages?.currentUserId || null,
  );

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [currentUserId, setCurrentUserId] = useState(
    currentUserFromStore || null,
  );

  // 👇 همه‌ی ref/hookهای مرتبط با نوتیف و تایپینگ داخل کامپوننت
  const seenMessageIdsRef = useRef(new Set());
  const timeoutRef = useRef(null);
  const notifyAudioRef = useRef(null);
  const lastNotifyAtRef = useRef(0);
  const originalTitleRef = useRef(document.title);
  const sendJsonMessageRef = useRef(null); // برای جلوگیری از TDZ

  const rawToken = localStorage.getItem('access_token') || '';
  const accessToken = stripBearer(rawToken);

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
    document.title = `(${count}) ${originalTitleRef.current}`;
  };

  // 1) تعیین currentUserId از Redux یا JWT
  useEffect(() => {
    if (currentUserFromStore) {
      setCurrentUserId(currentUserFromStore);
      return;
    }
    if (isJwt(accessToken)) {
      try {
        const dec = jwtDecode(accessToken);
        const id = dec?.user_id ?? dec?.sub ?? null;
        if (id) setCurrentUserId(Number(id));
      } catch (e) {
        console.warn('JWT decode skipped (not fatal):', e?.message);
      }
    }
  }, [currentUserFromStore, accessToken]);

  // 2) اگر هنوز id نداریم و توکن داریم، /me را بخوان
  useEffect(() => {
    const needFetchMe = !currentUserId && !!accessToken && endpoints?.me;
    if (!needFetchMe) return;
    let abort = false;
    (async () => {
      try {
        const resp = await fetch(endpoints.me, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) throw new Error(`GET /me ${resp.status}`);
        const me = await resp.json().catch(() => ({}));
        if (!abort && me?.id) setCurrentUserId(Number(me.id));
      } catch (e) {
        console.warn('[me] fallback failed:', e?.message);
      }
    })();
    return () => {
      abort = true;
    };
  }, [currentUserId, accessToken, endpoints]);

  // 3) گرفتن پیام‌ها
  const fetchConfig = useMemo(
    () =>
      roomId ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
    [roomId, accessToken],
  );

  const {
    data: fetchedMessages,
    loading,
    error: fetchError,
  } = useFetch(
    roomId && endpoints?.roomMessages ? endpoints.roomMessages(roomId) : null,
    fetchConfig,
  );

  useEffect(() => {
    if (Array.isArray(fetchedMessages)) setMessages(fetchedMessages);
  }, [fetchedMessages]);

  useEffect(() => {
    if (fetchError) {
      console.error('Error fetching messages:', fetchError);
      setError('Error fetching messages. Please try again.');
    }
  }, [fetchError]);

  // 4) WS فقط در حالت Django
  const socketUrl = useMemo(() => {
    if (!IS_DJANGO || !roomId) return null;
    return buildWsUrlForDjango(roomId, accessToken);
  }, [IS_DJANGO, roomId, accessToken]);

  // 🔧 هندلر اصلی نوتیف‌ها (بدون وابستگی مستقیم به sendJsonMessage)
  const handleNotification = useCallback(
    (packet) => {
      if (!packet || !packet.type) return;

      switch (packet.type) {
        case 'message': {
          const m = packet.message;
          if (m && !seenMessageIdsRef.current.has(m.id)) {
            seenMessageIdsRef.current.add(m.id);
            setMessages((prev) => [...prev, m]);
          }

          dispatch(updateMessages(packet));

          if (m?.sender_id && currentUserId && m.sender_id !== currentUserId) {
            try {
              sendJsonMessageRef.current?.({
                type: 'read_receipt_confirmation',
                message_id: m.id,
              });
            } catch {}

            try {
              const now = Date.now();
              if (now - lastNotifyAtRef.current > 1200) {
                lastNotifyAtRef.current = now;
                toast?.info(m.content ?? 'پیام جدید');
                notifyAudioRef.current?.play().catch(() => {});
                showDesktopNotification(
                  m.sender_name || 'پیام جدید',
                  m.content || '',
                  () => {
                    // اختیاری: dispatch(selectRoom(m.room_id))
                  },
                );
                if (document.hidden) bumpTitle();
              }
            } catch {}
          }
          break;
        }

        case 'typing_indicator': {
          if (packet.user_id) {
            // کاربر: «تیپینگ» (واژه: تایپینگ) — pronunciation: «تای-پینگ»
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
          console.warn('Unknown WS type:', packet.type);
      }
    },
    [dispatch, currentUserId, showDesktopNotification],
  );

  // حالا WS را بسازیم و ref را پر کنیم
  const { sendJsonMessage, readyState } = useChatWebSocket(
    socketUrl,
    handleNotification,
  );
  useEffect(() => {
    sendJsonMessageRef.current = sendJsonMessage;
  }, [sendJsonMessage]);

  useEffect(() => {
    setConnectionStatus(
      socketUrl
        ? readyState === 0
          ? 'Connecting...'
          : readyState === 1
          ? 'Connected'
          : readyState === 2
          ? 'Disconnecting...'
          : readyState === 3
          ? 'Disconnected'
          : '—'
        : 'Echo/Reverb (WS handled by Echo)',
    );
  }, [readyState, socketUrl]);

  // 5) ارسال پیام
  const handleSendMessage = useCallback(
    async (e) => {
      e.preventDefault();
      const text = messageInput.trim();
      if (!text) {
        setError('Message cannot be empty');
        return;
      }

      if (IS_DJANGO) {
        if (readyState !== 1) {
          setError('WebSocket connection is not open. Please try again later.');
          return;
        }
        try {
          sendJsonMessageRef.current?.({ type: 'chat_message', content: text });
          setMessageInput('');
          setError(null);
        } catch (err) {
          console.error('Error sending message (WS):', err);
          setError(`Error sending message. Details: ${err.message}`);
        }
        return;
      }

      // Laravel/Reverb → HTTP
      try {
        const url = endpoints?.roomMessages
          ? endpoints.roomMessages(roomId)
          : null;
        if (!url) throw new Error('roomMessages endpoint is missing');

        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ content: text }),
        });

        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({}));
          throw new Error(errBody?.error || `POST message ${resp.status}`);
        }

        const saved = await resp.json().catch(() => ({}));
        if (saved?.id) {
          setMessages((prev) => [...prev, saved]);
        } else {
          const localMsg = {
            id: Date.now(),
            content: text,
            sender_id: currentUserId || null,
            created_at: new Date().toISOString(),
            read_receipt: false,
          };
          setMessages((prev) => [...prev, localMsg]);
        }

        setMessageInput('');
        setError(null);
      } catch (err) {
        console.error('Error sending message (HTTP):', err);
        setError(err.message || 'Failed to send message');
      }
    },
    [
      IS_DJANGO,
      messageInput,
      readyState,
      endpoints,
      roomId,
      accessToken,
      currentUserId,
    ],
  );

  const handleInputChange = useCallback(
    (e) => {
      setMessageInput(e.target.value);
      if (e.target.value.trim() !== '' && currentUserId && IS_DJANGO) {
        sendJsonMessageRef.current?.({
          type: 'typing_indicator',
          sender_id: currentUserId,
        });
      }
    },
    [currentUserId, IS_DJANGO],
  );

  if (!roomId)
    return (
      <div className="no-chat-selected">Select a chat to start messaging</div>
    );

  return (
    <div className="chat-window">
      {loading && (
        <div className="loading-spinner">
          <Spinner animation="border" />
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="connection-status">{connectionStatus}</div>

      <MessageList messages={messages} currentUserId={currentUserId} />
      <TypingIndicator typing={typing} />

      <Form onSubmit={handleSendMessage} className="chat-input-form">
        <Form.Group controlId="messageInput">
          <Form.Control
            type="text"
            placeholder="Type a message..."
            value={messageInput}
            onChange={handleInputChange}
          />
        </Form.Group>
        <Button type="submit" variant="primary">
          Send
        </Button>
      </Form>
    </div>
  );
};

export default ChatWindow;
