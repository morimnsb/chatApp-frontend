import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import useFetch from '../hooks/useFetch'; // Adjust path if necessary
import useChatWebSocket from '../hooks/useChatWebSocket'; // Adjust path if necessary
import './ChatWindow.css';
import { jwtDecode } from 'jwt-decode'; // Corrected import
import { useDispatch } from 'react-redux'; // Import useDispatch
import {
  updateLastMessage,
  resetTypingIndicator,
} from '../actions/messageActions'; // Import action creators

const ChatWindow = ({ roomId }) => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(null);
  const dispatch = useDispatch(); // Initialize dispatch from Redux

  const accessToken = localStorage.getItem('access_token');
  const currentUser = useMemo(() => {
    try {
      return jwtDecode(accessToken)?.user_id || null;
    } catch (error) {
      console.error('Error decoding access token:', error);
      setError('Error decoding access token.');
      return null;
    }
  }, [accessToken]);

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

  const handleNotification = useCallback(
    (message) => {
      if (!message || !message.type) return;

      switch (message.type) {
        case 'message':
          if (message.message) {
            setMessages((prevMessages) => {
              if (!prevMessages.some((msg) => msg.id === message.message.id)) {
                // Dispatch the action to update the last message in MessageList
                dispatch(
                  updateLastMessage(message.message.sender_id, message.message),
                );
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
            setTimeout(
              () => dispatch(resetTypingIndicator(message.user_id)),
              5000,
            );
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
    [currentUser, dispatch],
  );

  const { sendJsonMessage, readyState } = useChatWebSocket(
    socketUrl,
    handleNotification,
  );

  useEffect(() => {
    if (roomId && fetchedMessages) {
      setMessages(fetchedMessages);

      // Update last message in MessageList
      if (fetchedMessages.length > 0) {
        dispatch(
          updateLastMessage(
            fetchedMessages[fetchedMessages.length - 1].id, // Use the last message ID as room ID
            fetchedMessages[fetchedMessages.length - 1],
          ),
        );
      }
    }
  }, [fetchedMessages, roomId, dispatch]);

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

      <Form onSubmit={handleSendMessage} className="message-form">
        <Form.Group>
          <Form.Control
            type="text"
            placeholder="Type your message..."
            value={messageInput}
            onChange={handleInputChange}
          />
        </Form.Group>
        <Button type="submit" disabled={readyState !== WebSocket.OPEN}>
          Send
        </Button>
      </Form>

      {typing && <div className="typing-indicator">User is typing...</div>}
    </div>
  );
};

export default ChatWindow;
