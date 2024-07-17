import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import './ChatWindow.css';
import useWebSocket from 'react-use-websocket';

const ChatWindow = ({ roomId }) => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const accessToken = localStorage.getItem('access_token');
  const socketUrl = `ws://localhost:8000/ws/chat/${roomId}/?token=${accessToken}`;

  // Initialize useWebSocket hook
  const { sendMessage, lastMessage, readyState } = useWebSocket(socketUrl, {
    onOpen: () => console.log('WebSocket connection established'),
    onClose: () => console.log('WebSocket connection closed'),
    onError: (error) => setError(`WebSocket error: ${error.message}`),
  });

  // Function to fetch previous messages
  const fetchPreviousMessages = async () => {
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
      console.log('messages:', response.data);
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching previous messages:', error);
      setError('Error fetching previous messages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch previous messages when roomId or accessToken changes
  useEffect(() => {
    fetchPreviousMessages();
  }, [roomId, accessToken]);

  // Process incoming WebSocket messages
  useEffect(() => {
    if (lastMessage !== null) {
      const message = JSON.parse(lastMessage.data);
      console.log('new message', message);
      setMessages((prevMessages) => [...prevMessages, message.message]);
    }
  }, [lastMessage]);

  // Handle sending messages via WebSocket
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim()) {
      setError('Message cannot be empty');
      return;
    }

    sendMessage(JSON.stringify({ message: messageInput }));
    setMessageInput('');
    setError(null);
  };

  // Handle input change
  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
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
          messages.map((msg, index) =>
            msg && msg.sender_first_name ? (
              <div key={index} className={`message-bubble`}>
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
              </div>
            ) : (
              <div key={index} className="message-bubble">
                <div className="message-text">
                  {msg ? msg.content : 'Message content not available'}
                  <span className="message-time">
                    {msg ? msg.timestamp : ''}
                  </span>
                </div>
              </div>
            ),
          )
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
        <Button variant="primary" type="submit">
          Send
        </Button>
      </Form>
    </div>
  );
};

export default ChatWindow;
