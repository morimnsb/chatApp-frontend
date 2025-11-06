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

const ChatWindow = ({ roomId }) => {
  const dispatch = useDispatch();

  // ✅ سعی کن از Redux (یا پدر) شناسه کاربر را بگیری؛ اگر نبود، می‌ریم سراغ توکن
  const currentUserFromStore = useSelector(
    (s) => s.auth?.currentUser?.id || s.messages?.currentUserId || null,
  );

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const timeoutRef = useRef(null);

  const apiUrl = process.env.REACT_APP_API_URL;
  const rawToken = localStorage.getItem('access_token') || '';
  const accessToken = stripBearer(rawToken);

  // ✅ currentUserId مقاوم: اول Redux، بعد JWT، بعد fallback به /me
  const [currentUserId, setCurrentUserId] = useState(
    currentUserFromStore || null,
  );

  useEffect(() => {
    if (currentUserFromStore) {
      setCurrentUserId(currentUserFromStore);
      return;
    }
    // اگر JWT معتبر است، decode
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

  // اگر هنوز id نداریم و توکن هست، از /me بگیر (لاراول opaque token)
  useEffect(() => {
    const needFetchMe = !currentUserId && !!accessToken && apiUrl;
    if (!needFetchMe) return;
    let abort = false;
    (async () => {
      try {
        const resp = await fetch(`${apiUrl}/api/auth/me`, {
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
  }, [currentUserId, accessToken, apiUrl]);

  // ✅ فقط وقتی roomId داریم fetch کن
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
    roomId ? `${apiUrl}/chatMeetUp/messages/${roomId}/` : null,
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

  // ✅ WS URL فقط اگر لازم شد؛ تو پروژه شما Reverb/Echo جداست، پس این می‌تونه null باشند
  const socketUrl = useMemo(() => {
    if (!roomId) return null;
    const base = `${apiUrl}/ws/chat/${roomId}/`;
    const tokenParam = isJwt(accessToken) ? `?token=${accessToken}` : '';
    return base + tokenParam;
  }, [apiUrl, roomId, accessToken]);

  const handleNotification = useCallback(
    (packet) => {
      if (!packet || !packet.type) return;
      switch (packet.type) {
        case 'message': {
          const m = packet.message;
          if (m && !messages.some((x) => x.id === m.id)) {
            setMessages((prev) => [...prev, m]);
          }
          dispatch(updateMessages(packet));
          if (m?.sender_id && currentUserId && m.sender_id !== currentUserId) {
            sendJsonMessage?.({
              type: 'read_receipt_confirmation',
              message_id: m.id,
            });
          }
          break;
        }
        case 'typing_indicator': {
          if (packet.user_id) {
            setTyping(packet.user_id);
            clearTimeout(timeoutRef.current);
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
    [dispatch, messages, currentUserId],
  );

  const { sendJsonMessage, readyState } = useChatWebSocket(
    socketUrl,
    handleNotification,
  );

  useEffect(() => {
    setConnectionStatus(
      readyState === 0
        ? 'Connecting...'
        : readyState === 1
        ? 'Connected'
        : readyState === 2
        ? 'Disconnecting...'
        : readyState === 3
        ? 'Disconnected'
        : '—',
    );
  }, [readyState]);

  const handleSendMessage = useCallback(
    (e) => {
      e.preventDefault();
      if (!messageInput.trim()) {
        setError('Message cannot be empty');
        return;
      }
      if (readyState !== 1) {
        setError('WebSocket connection is not open. Please try again later.');
        return;
      }
      try {
        sendJsonMessage?.({ type: 'chat_message', content: messageInput });
        setMessageInput('');
        setError(null);
      } catch (err) {
        console.error('Error sending message:', err);
        setError(`Error sending message. Details: ${err.message}`);
      }
    },
    [messageInput, readyState, sendJsonMessage],
  );

  const handleInputChange = useCallback(
    (e) => {
      setMessageInput(e.target.value);
      if (e.target.value.trim() !== '' && currentUserId) {
        sendJsonMessage?.({
          type: 'typing_indicator',
          sender_id: currentUserId,
        });
      }
    },
    [sendJsonMessage, currentUserId],
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
