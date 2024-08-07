import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import './ChatWindow.css';
import useWebSocket from 'react-use-websocket';
import {jwtDecode} from 'jwt-decode';

const ChatWindow = ({ roomId }) => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(null);
  const accessToken = localStorage.getItem('access_token');
  const socketUrl = `ws://localhost:8000/ws/chat/${roomId}/?token=${accessToken}`;

  const { sendMessage, lastMessage, readyState } = useWebSocket(socketUrl, {
    onOpen: () => console.log('WebSocket connection established'),
    onClose: () => console.log('WebSocket connection closed'),
    onError: (error) => setError(`WebSocket error: ${error.message}`),
    shouldReconnect: () => true,
  });

  let decodedToken;

  try {
    decodedToken = jwtDecode(accessToken);
  } catch (error) {
    console.error('Error decoding access token:', error);
  }

  const currentUser = decodedToken?.user_id;

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

  useEffect(() => {
    fetchPreviousMessages();
  }, [fetchPreviousMessages]);

  useEffect(() => {
    if (lastMessage !== null) {
      try {
        const message = JSON.parse(lastMessage.data);
        console.log('Received WebSocket message:', message);

        if (!message || !message.type) {
          console.error('Received message does not have a type:', message);
          return;
        }

        switch (message.type) {
          case 'message':
            if (message.message) {
              // Update state with new message without duplicating
              setMessages((prevMessages) => {
                // Check if the message already exists
                if (prevMessages.some((msg) => msg.id === message.message.id)) {
                  return prevMessages;
                }
                return [...prevMessages, message.message];
              });

              // Send read receipt confirmation if the message is from someone else
              if (message.message.sender_id !== currentUser) {
                sendMessage(
                  JSON.stringify({
                    type: 'read_receipt_confirmation',
                    message_id: message.message.id,
                  }),
                );
              }
            } else {
              console.error(
                'Message type is "message" but no "message" field found:',
                message,
              );
            }
            break;

          case 'typing_indicator':
            console.log('message in typing_indicator', message);
            if (
              message.message
            ) {
              setTyping(message.message); // Ensure message.user_id is a string
              setTimeout(() => setTyping(null), 5000);
            } else {
              console.error(
                'Typing indicator message missing or invalid user_id:',
                message,
              );
            }
            break;

          case 'message_received':
            console.log(
              `Received read receipt confirmation for Message ID ${message.message}`,
            );
            setMessages((prevMessages) => {
              // Map through previous messages and update the relevant message
              const updatedMessages = prevMessages.map((msg) =>
                msg.id === message.message
                  ? { ...msg, read_receipt: true }
                  : msg,
              );

             

              return updatedMessages;
            });
            break;

          default:
            console.error('Unknown message type:', message.type);
            console.error('Unknown message :', message);
            

        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        setError('Error processing new message.');
      }
    }
  }, [lastMessage, sendMessage, currentUser]);


  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim()) {
      setError('Message cannot be empty');
      return;
    }

    try {
      sendMessage(
        JSON.stringify({
          type: 'chat_message',
          content: messageInput,
          // You may not need to add `id` here; it's managed by the server
        }),
      );
      setMessageInput('');
      setError(null);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Error sending message. Please try again.');
    }
  };

  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    if (e.target.value.trim() !== '') {
      sendMessage(
        JSON.stringify({
          type: 'typing_indicator',
          user_id: currentUser,
        }),
      );
    }
  };

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
            <div key={msg.id} className={`message-bubble`}>
              {msg.sender_first_name ? (
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
                    {msg.sender_id === currentUser && (
                      <span
                        className={`read_receipt ${
                          msg.read_receipt ? 'read' : ''
                        }`}
                      >
                        ✓✓
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="message-text">
                  {msg.content}
                  <span className="message-time">{msg.timestamp}</span>
                  {msg.sender_id === currentUser && (
                    <span
                      className={`read_receipt ${
                        msg.read_receipt ? 'read' : ''
                      }`}
                    >
                      ✓
                    </span>
                  )}
                </div>
              )}
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
       <div className="typing-indicator">User {typing} is typing...</div> // Ensure `typing` is a string or number
      )}
    </div>
  );
};

export default ChatWindow;
