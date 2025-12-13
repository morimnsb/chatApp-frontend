// src/components/ChatWindow.js
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
import useFetch from '@/hooks/useFetch';
import { resetTypingIndicator, updateMessages } from '@/actions/messageActions';
import { formatTime } from '@/utils/formatTime';
import profilephoto1 from '@/assets/images/message/profilephoto1.png';
import { toast } from 'react-toastify';

// ⭐ فقط این هوک برای WS استفاده می‌شود
import useRoomTransport from '@/hooks/useRoomTransport';

const isJwt = (t) => typeof t === 'string' && t.split('.').length === 3;
const stripBearer = (t) => (t || '').toString().replace(/^Bearer\s+/i, '');

const ROOM_DEBUG = '[ChatWindow]';

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

const ChatWindow = ({
  roomId,
  endpoints,
  effectiveKind,
  accessToken: accessTokenProp,
}) => {
  const dispatch = useDispatch();

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

  const seenMessageIdsRef = useRef(new Set());
  const timeoutRef = useRef(null);
  const notifyAudioRef = useRef(null);
  const lastNotifyAtRef = useRef(0);
  const originalTitleRef = useRef(document.title);

  const rawToken = accessTokenProp || '';
  const accessToken = stripBearer(rawToken);

  /* -------------------- DEBUG: mount info -------------------- */

  useEffect(() => {
    console.log(ROOM_DEBUG, 'mount', {
      roomId,
      effectiveKind,
      hasAccessToken: !!accessToken,
      currentUserFromStore,
    });
  }, [roomId, effectiveKind, accessToken, currentUserFromStore]);

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
    console.log(ROOM_DEBUG, 'currentUser effect', {
      currentUserFromStore,
      hasToken: !!accessToken,
    });

    if (currentUserFromStore) {
      setCurrentUserId(currentUserFromStore);
      return;
    }
    if (isJwt(accessToken)) {
      try {
        const dec = jwtDecode(accessToken);
        const id = dec?.user_id ?? dec?.sub ?? null;
        console.log(ROOM_DEBUG, 'decoded JWT', { dec, id });
        if (id) setCurrentUserId(Number(id));
      } catch (e) {
        console.warn(ROOM_DEBUG, 'JWT decode skipped:', e?.message);
      }
    }
  }, [currentUserFromStore, accessToken]);

  useEffect(() => {
    const needFetchMe = !currentUserId && !!accessToken && endpoints?.me;
    console.log(ROOM_DEBUG, 'me fallback check', {
      needFetchMe,
      currentUserId,
      hasToken: !!accessToken,
      hasMeEndpoint: !!endpoints?.me,
    });

    if (!needFetchMe) return;
    let abort = false;
    (async () => {
      try {
        console.log(ROOM_DEBUG, 'fetching /me', endpoints.me);
        const resp = await fetch(endpoints.me, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) throw new Error(`GET /me ${resp.status}`);
        const me = await resp.json().catch(() => ({}));
        console.log(ROOM_DEBUG, '/me response', me);
        if (!abort && me?.id) setCurrentUserId(Number(me.id));
      } catch (e) {
        console.warn(ROOM_DEBUG, '[me] fallback failed:', e?.message);
      }
    })();
    return () => {
      abort = true;
    };
  }, [currentUserId, accessToken, endpoints]);

  /* -------------------- گرفتن پیام‌ها (HTTP فقط برای history) -------------------- */

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
    if (!fetchedMessages) {
      console.log(ROOM_DEBUG, 'no fetchedMessages yet');
      return;
    }

    console.log(ROOM_DEBUG, 'fetchedMessages raw', fetchedMessages);

    let arr = [];

    if (Array.isArray(fetchedMessages)) {
      arr = fetchedMessages;
    } else if (Array.isArray(fetchedMessages.messages)) {
      arr = fetchedMessages.messages;
    } else if (Array.isArray(fetchedMessages.data)) {
      arr = fetchedMessages.data;
    }

    console.log(ROOM_DEBUG, 'normalized history messages', {
      count: arr.length,
      sample: arr[0],
    });

    setMessages(arr);
  }, [fetchedMessages]);

  useEffect(() => {
    if (fetchError) {
      console.error(ROOM_DEBUG, 'Error fetching messages:', fetchError);
      setError('Error fetching messages. Please try again.');
    }
  }, [fetchError]);

  /* -------------------- DEBUG: track messages length -------------------- */

  useEffect(() => {
    console.log(ROOM_DEBUG, 'messages state changed', {
      count: messages.length,
      last: messages[messages.length - 1],
    });
  }, [messages]);

  /* -------------------- handler مشترک برای تمام packetها -------------------- */

  const handleNotification = useCallback(
    (packet) => {
      console.log(ROOM_DEBUG, '[ROOM WS] incoming packet', packet);
      if (!packet || !packet.type) {
        console.warn(ROOM_DEBUG, 'packet without type ignored', packet);
        return;
      }

      switch (packet.type) {
        case 'message': {
          const m = packet.message;
          console.log(ROOM_DEBUG, 'message packet', {
            msgId: m?.id,
            roomId,
            sender_id: m?.sender_id,
          });

          if (m && !seenMessageIdsRef.current.has(m.id)) {
            console.log(
              ROOM_DEBUG,
              'adding new message to state & seenMessageIds',
              m.id,
            );
            seenMessageIdsRef.current.add(m.id);
            setMessages((prev) => [...prev, m]);
          } else if (m) {
            console.log(
              ROOM_DEBUG,
              'message already seen, skipping append',
              m.id,
            );
          }

          console.log(ROOM_DEBUG, 'dispatch updateMessages', packet);
          dispatch(updateMessages(packet));

          if (m?.sender_id && currentUserId && m.sender_id !== currentUserId) {
            console.log(ROOM_DEBUG, 'incoming message from other user', {
              currentUserId,
              sender_id: m.sender_id,
            });
            try {
              const now = Date.now();
              if (now - lastNotifyAtRef.current > 1200) {
                lastNotifyAtRef.current = now;
                toast?.info(m.content ?? 'پیام جدید');
                notifyAudioRef.current?.play().catch(() => {});
                showDesktopNotification(
                  m.sender_name || 'پیام جدید',
                  m.content || '',
                  () => {},
                );
                if (document.hidden) bumpTitle();
              }
            } catch (e) {
              console.warn(ROOM_DEBUG, 'notification error', e);
            }
          }
          break;
        }

        case 'typing_indicator': {
          console.log(ROOM_DEBUG, 'typing_indicator packet', packet);
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
          console.log(ROOM_DEBUG, 'message_received packet', packet);
          setMessages((prev) =>
            prev.map((x) =>
              x.id === packet.message ? { ...x, read_receipt: true } : x,
            ),
          );
          break;
        }

        default:
          console.warn(ROOM_DEBUG, 'Unknown WS type:', packet.type, packet);
      }
    },
    [dispatch, currentUserId, showDesktopNotification, roomId],
  );

  /* -------------------- ترنسپورت یکپارچه (Django + Reverb) -------------------- */

  const {
    status: transportStatus,
    connectionLabel,
    sendMessage,
    sendTyping,
  } = useRoomTransport({
    backendKind: effectiveKind,
    roomId,
    accessToken,
    handleNotification,
    currentUserId,
  });

  useEffect(() => {
    console.log(ROOM_DEBUG, 'transport status changed', {
      transportStatus,
      connectionLabel,
    });
    setConnectionStatus(connectionLabel || '—');
  }, [connectionLabel, transportStatus]);

  /* -------------------- ارسال پیام (فقط WebSocket) -------------------- */

  const handleSendMessage = useCallback(
    async (e) => {
      e.preventDefault();
      const text = messageInput.trim();
      console.log(ROOM_DEBUG, 'handleSendMessage called', {
        roomId,
        text,
        transportStatus,
      });

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
          console.warn(
            ROOM_DEBUG,
            'send blocked: transportStatus =',
            transportStatus,
          );
          setError('WebSocket connection is not open. Please try again later.');
          return;
        }

        console.log(ROOM_DEBUG, 'sending message via WS', {
          roomId,
          text,
          backendKind: effectiveKind,
        });

        await sendMessage(text);

        console.log(ROOM_DEBUG, 'sendMessage resolved OK');
        setMessageInput('');
        setError(null);
      } catch (err) {
        console.error(ROOM_DEBUG, 'Error sending message (WS):', err);
        setError(err.message || 'Failed to send message');
      }
    },
    [messageInput, sendMessage, transportStatus, roomId, effectiveKind],
  );

  /* -------------------- تایپینگ -------------------- */

  const handleInputChange = useCallback(
    (e) => {
      const val = e.target.value;
      setMessageInput(val);

      console.log(ROOM_DEBUG, 'input change', {
        roomId,
        value: val,
        currentUserId,
      });

      if (val.trim() === '' || !currentUserId) return;

      console.log(ROOM_DEBUG, 'sending typing', {
        roomId,
        userId: currentUserId,
      });

      // backend-agnostic: خود useRoomTransport تصمیم می‌گیرد
      sendTyping(currentUserId);
    },
    [currentUserId, sendTyping, roomId],
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

      <div className="connection-status">
        {connectionStatus}{' '}
        <span style={{ opacity: 0.6, fontSize: 11 }}>
          ({ROOM_DEBUG} roomId={roomId}, backend={String(effectiveKind)})
        </span>
      </div>

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
