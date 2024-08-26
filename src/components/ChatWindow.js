import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import useFetch from './useFetch';
import './ChatWindow.css';
import { jwtDecode } from 'jwt-decode';
import useChatWebSocket from './useChatWebSocket';

const ChatWindow = ({ roomId }) => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(null);

  const accessToken = localStorage.getItem('access_token');

  // Only create socket URL and fetch config if roomId is valid
  const socketUrl = useMemo(
    () =>
      roomId
        ? `ws://localhost:8000/ws/chat/${roomId}/?token=${accessToken}`
        : null,
    [roomId, accessToken],
  );

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
    roomId ? `http://localhost:8000/chatMeetUp/messages/${roomId}/` : null,
    fetchConfig,
  );

  const currentUser = useMemo(() => {
    try {
      return jwtDecode(accessToken)?.user_id || null;
    } catch (error) {
      console.error('Error decoding access token:', error);
      setError('Error decoding access token.');
      return null;
    }
  }, [accessToken]);

  const handleNotification = useCallback(
    (message) => {
      if (!message || !message.type) return;

      switch (message.type) {
        case 'message':
          if (message.message) {
            setMessages((prevMessages) => {
              if (!prevMessages.some((msg) => msg.id === message.message.id)) {
                return [...prevMessages, message.message];
              }
              return prevMessages;
            });

            if (message.message.sender_id !== currentUser) {
              sendJsonMessage({
                type: 'read_receipt_confirmation',
                message_id: message.message.id,
              });
            }
          }
          break;

        case 'typing_indicator':
          if (message.user_id) {
            setTyping(message.user_id);
            setTimeout(() => setTyping(null), 5000);
          }
          break;

        case 'message_received':
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === message.message ? { ...msg, read_receipt: true } : msg,
            ),
          );
          break;

        default:
          console.error('Unknown message type:', message.type);
      }
    },
    [currentUser],
  );

  const { sendJsonMessage, readyState } = useChatWebSocket(
    socketUrl,
    handleNotification,
  );

  useEffect(() => {
    if (roomId && fetchedMessages) {
      setMessages(fetchedMessages);
    }
  }, [fetchedMessages, roomId]);

  useEffect(() => {
    if (fetchError) {
      console.error('Error fetching messages:', fetchError);
      setError('Error fetching messages. Please try again.');
    }
  }, [fetchError]);

  const handleSendMessage = useCallback(
    (e) => {
      e.preventDefault();
      if (!messageInput.trim()) {
        setError('Message cannot be empty');
        return;
      }

      try {
        sendJsonMessage({ type: 'chat_message', content: messageInput });
        setMessageInput('');
        setError(null);
      } catch (error) {
        console.error('Error sending message:', error);
        setError('Error sending message. Please try again.');
      }
    },
    [messageInput, sendJsonMessage],
  );

  const handleInputChange = useCallback(
    (e) => {
      setMessageInput(e.target.value);
      if (e.target.value.trim() !== '') {
        sendJsonMessage({ type: 'typing_indicator', sender_id: currentUser });
      }
    },
    [sendJsonMessage, currentUser],
  );

  const formatTime = useCallback((timestamp) => {
    try {
      const date = parseISO(timestamp);
      if (isToday(date)) {
        return format(date, 'hh:mm a');
      } else if (isYesterday(date)) {
        return `Yesterday at ${format(date, 'hh:mm a')}`;
      } else {
        return format(date, 'MMM d, yyyy, hh:mm a');
      }
    } catch (error) {
      console.error('Error formatting time:', error);
      return timestamp;
    }
  }, []);

  if (!roomId) {
    return (
      <div className="no-chat-selected">Select a chat to start messaging</div>
    );
  }

  return (
    <div className="chat-window">
      {loading && (
        <div className="loading-spinner">
          <Spinner animation="border" />
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="messages">
        {messages.length > 0 ? (
          messages.map((msg) => (
            <div key={msg.id} className="message-bubble">
              {msg.sender_first_name && (
                <div className="chat-header-details">
                  <img
                    src={msg.photo || 'default-image.png'}
                    alt={msg.sender_first_name}
                    className="chat-header-img"
                  />
                  <div className="chat-header-info">
                    <h4>{msg.sender_first_name}</h4>
                  </div>
                </div>
              )}
              <div className="message-text">
                {msg.content}
                <span className="message-time">
                  {formatTime(msg.timestamp)}
                </span>
                {msg.sender_id === currentUser && (
                  <span
                    className={`read_receipt ${msg.read_receipt ? 'read' : ''}`}
                  >
                    ✓✓
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="no-messages">No messages yet</div>
        )}
      </div>

      <Form className="message-input" onSubmit={handleSendMessage}>
        <Form.Control
          type="text"
          placeholder="Type a message..."
          value={messageInput}
          onChange={handleInputChange}
        />
        <Button
          variant="primary"
          type="submit"
          disabled={readyState !== WebSocket.OPEN}
        >
          Send
        </Button>
      </Form>

      {typing && (
        <div className="typing-indicator">User {typing} is typing...</div>
      )}
    </div>
  );
};

export default ChatWindow;
