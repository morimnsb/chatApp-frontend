import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import './ChatWindow.css';
import useWebSocket from 'react-use-websocket';
import { jwtDecode } from 'jwt-decode';

const ChatWindow = ({ roomId }) => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(null); // Track the user who is typing
  const accessToken = localStorage.getItem('access_token');
  const socketUrl = `ws://localhost:8000/ws/chat/${roomId}/?token=${accessToken}`;

  // Initialize useWebSocket hook
  const { sendMessage, lastMessage, readyState } = useWebSocket(socketUrl, {
    onOpen: () => console.log('WebSocket connection established'),
    onClose: () => console.log('WebSocket connection closed'),
    onError: (error) => setError(`WebSocket error: ${error.message}`),
    shouldReconnect: (closeEvent) => true, // Automatically try to reconnect
  });
  let decodedToken;

  try {
    decodedToken = jwtDecode(accessToken);
  } catch (error) {
    console.error('Error decoding access token:', error);
  }

  const currentUser = decodedToken?.user_id;
  // Function to fetch previous messages
  const fetchPreviousMessages = useCallback(async () => {
    setLoading(true);
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      };

      const response = await axios.get(
        `http://localhost:8000/chatMeetUp/messages/${roomId}/`,
        config,
      );
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching previous messages:', error);
      setError('Error fetching previous messages. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, roomId]);

  // Fetch previous messages when roomId or accessToken changes
  useEffect(() => {
    fetchPreviousMessages();
  }, [fetchPreviousMessages]);

  // Process incoming WebSocket messages
  useEffect(() => {
    if (lastMessage !== null) {
      try {
        const message = JSON.parse(lastMessage.data);
        console.log('Received WebSocket message:', message); // Debugging output

        if (!message || !message.type) {
          console.error('Received message does not have a type:', message);
          return;
        }

        switch (message.type) {
          case 'message':
            if (message.message) {
              setMessages((prevMessages) => [...prevMessages, message.message]);
            } else {
              console.error(
                'Message type is "message" but no "message" field found:',
                message,
              );
            }
            break;
          case 'typing_indicator':
            if (message.user_id) {
              setTyping(message.user_id.user_id); 
              console.log('setTyping for ', message.user_id.user_id);
              setTimeout(() => setTyping(null), 5000); // Hide after 5 seconds
            } else {
              console.error(
                'Typing indicator message missing user_id:',
                message,
              );
            }
            break;
          default:
            console.error('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        setError('Error processing new message.');
      }
    }
  }, [lastMessage]);

  // Handle sending messages via WebSocket
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim()) {
      setError('Message cannot be empty');
      return;
    }

    try {
      sendMessage(
        JSON.stringify({
          type: 'message',
          content: messageInput,
        }),
      );
      setMessageInput('');
      setError(null);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Error sending message. Please try again.');
    }
  };

  // Handle input change
  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    // Notify the server that the user is typing
    if (e.target.value.trim() !== '') {
      sendMessage(
        JSON.stringify({
          type: 'typing_indicator',
          user_id: currentUser, // Send user ID to identify who is typing
        }),
      );
    }
  };

  return (
    <div className="chat-window">
      {/* Render loading spinner if loading */}
      {loading && (
        <div className="loading-spinner">
          <Spinner animation="border" />
        </div>
      )}

      {/* Render error alert if there's an error */}
      {error && <Alert variant="danger">{error}</Alert>}

      {/* Render messages */}
      <div className="messages">
        {messages.length > 0 ? (
          messages.map((msg, index) => (
            <div key={index} className={`message-bubble`}>
              {msg && msg.sender_first_name ? (
                <>
                  <div className="chat-header-details">
                    <img
                      src={msg.photo}
                      alt={msg.sender_first_name}
                      className="chat-header-img"
                    />
                    <div className="chat-header-info">
                      <h4>{msg.sender_first_name}</h4>
                    </div>
                  </div>
                  <div className="message-text">
                    {msg.content}
                    <span className="message-time">{msg.timestamp}</span>
                  </div>
                </>
              ) : (
                <div className="message-text">
                  {msg ? msg.content : 'Message content not available'}
                  <span className="message-time">
                    {msg ? msg.timestamp : ''}
                  </span>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="no-messages">No messages yet</div>
        )}
      </div>

      {/* Message input form */}
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

      {/* Display typing indicator if needed */}
      {typing && (
        <div className="typing-indicator">User {typing} is typing...</div>
      )}
    </div>
  );
};

export default ChatWindow;
