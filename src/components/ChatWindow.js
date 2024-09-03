import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import useFetch from '../hooks/useFetch';
import useChatWebSocket from '../hooks/useChatWebSocket';
import { useDispatch } from 'react-redux';
import {
  // updateLastMessage,
  resetTypingIndicator,
  updateMessages,
} from '../actions/messageActions';
import { formatTime } from '../utils/formatTime';
import { jwtDecode } from 'jwt-decode';
import './ChatWindow.css';

const MessageBubble = React.memo(({ message, currentUser }) => (
  <div className="message-bubble">
    {message.sender_first_name && (
      <div className="chat-header-details">
        <img
          src={message.photo || 'default-image.png'}
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
      <span className="message-time">{formatTime(message.timestamp)}</span>
      {message.sender_id === currentUser && (
        <span className={`read_receipt ${message.read_receipt ? 'read' : ''}`}>
          ✓✓
        </span>
      )}
    </div>
  </div>
));

const MessageList = ({ messages, currentUser }) => (
  <div className="messages">
    {messages.length > 0 ? (
      messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} currentUser={currentUser} />
      ))
    ) : (
      <div className="no-messages">No messages yet</div>
    )}
  </div>
);

const TypingIndicator = ({ typing }) =>
  typing && <div className="typing-indicator">User is typing...</div>;

const ChatWindow = ({ roomId }) => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting');
  const dispatch = useDispatch();

  const accessToken = localStorage.getItem('access_token');
  const apiUrl = process.env.REACT_APP_API_URL;

  const currentUser = useMemo(() => {
    try {
      return jwtDecode(accessToken)?.user_id || null;
    } catch (error) {
      console.error('Error decoding access token:', error);
      setError('Your session has expired. Please log in again.');
      return null;
    }
  }, [accessToken]);

  const socketUrl = useMemo(
    () => (roomId ? `${apiUrl}/ws/chat/${roomId}/?token=${accessToken}` : null),
    [roomId, accessToken, apiUrl],
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
    roomId ? `${apiUrl}/chatMeetUp/messages/${roomId}/` : null,
    fetchConfig,
  );

  const handleNotification = useCallback(
    (message) => {
      if (!message || !message.type) return;

      switch (message.type) {
        case 'message':
          if (message.message) {
            setMessages((prevMessages) => {
              const existingMessage = prevMessages.find(
                (msg) => msg.id === message.message.id,
              );

              if (!existingMessage) {
                return [...prevMessages, message.message];
              }
              return prevMessages;
            });

            // Dispatch action to update messages
            dispatch(updateMessages(message));

            // Send read receipt confirmation for messages from others
            if (message.message.sender_id !== currentUser) {
              sendJsonMessage?.({
                type: 'read_receipt_confirmation',
                message_id: message.message.id,
              });
            }
          }
          break;

        case 'typing_indicator':
          if (message.user_id) {
            setTyping(message.user_id);
            setTimeout(() => {
              dispatch(resetTypingIndicator(message.user_id));
              setTyping(null); // Clear typing indicator after timeout
            }, 5000);
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
    if (readyState === 0) {
      setConnectionStatus('Connecting...');
    } else if (readyState === 1) {
      setConnectionStatus('Connected');
    } else if (readyState === 2) {
      setConnectionStatus('Disconnecting...');
    } else if (readyState === 3) {
      setConnectionStatus('Disconnected');
    }
  }, [readyState]);
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
      if (readyState !== 1) {
        setError('WebSocket connection is not open. Please try again later.');
        return;
      }
      try {
        sendJsonMessage?.({ type: 'chat_message', content: messageInput });
        setMessageInput('');
        setError(null);
      } catch (error) {
        console.error('Error sending message:', error);
        setError(`Error sending message. Details: ${error.message}`);
      }
    },
    [messageInput, sendJsonMessage, readyState],
  );

  const handleInputChange = useCallback(
    (e) => {
      setMessageInput(e.target.value);
      if (e.target.value.trim() !== '') {
        sendJsonMessage?.({ type: 'typing_indicator', sender_id: currentUser });
      }
    },
    [sendJsonMessage, currentUser],
  );

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

      <div className="connection-status">{connectionStatus}</div>

      <MessageList messages={messages} currentUser={currentUser} />

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