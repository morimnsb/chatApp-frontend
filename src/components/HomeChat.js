import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Spinner, Alert, Container, Row, Col } from 'react-bootstrap';
import './HomeChat.css';
import ChatWindow from './ChatWindow';
import {jwtDecode} from 'jwt-decode';
import useChatWebSocket from './useChatWebSocket';
import useFetch from './useFetch';
import { ToastContainer, toast } from 'react-toastify';
import Header from './Header';
import MessageList from './MessageList';
import UserModal from './UserModal';
import 'react-toastify/dist/ReactToastify.css';

const HomeChat = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [individualMessages, setIndividualMessages] = useState([]);
  const [groupMessages, setGroupMessages] = useState([]);
  
  const accessToken = localStorage.getItem('access_token');

  const currentUser = useMemo(() => {
    try {
      return jwtDecode(accessToken)?.user_id || null;
    } catch (error) {
      console.error('Error decoding access token:', error);
      return null;
    }
  }, [accessToken]);

  const socketUrl = `ws://localhost:8000/ws/chat/?token=${accessToken}`;

  const fetchConfig = useMemo(() => ({
    headers: { Authorization: `Bearer ${accessToken}` },
  }), [accessToken]);

  const {
    data: fetchedIndividualMessages,
    loading: loadingIndividual,
    error: errorIndividual,
  } = useFetch('http://localhost:8000/chatMeetUp/conversations/', fetchConfig);

  const {
    data: fetchedGroupMessages,
    loading: loadingGroup,
    error: errorGroup,
  } = useFetch('http://localhost:8000/chatMeetUp/chatrooms/');

  const {
    data: users,
    loading: loadingUsers,
    error: errorUsers,
  } = useFetch('http://localhost:8000/api/auth/users');

  useEffect(() => {
    if (fetchedIndividualMessages?.partners && Array.isArray(fetchedIndividualMessages.partners)) {
      setIndividualMessages(fetchedIndividualMessages.partners);
    }

    if (Array.isArray(fetchedGroupMessages)) {
      setGroupMessages(fetchedGroupMessages);
    }
  }, [fetchedIndividualMessages, fetchedGroupMessages]);

  const handleSelectChat = useCallback((roomId) => {
    setSelectedRoom(roomId);
  }, []);

  const handleNotification = useCallback((message) => {
    const { type, message: msg } = message;
    
    switch (type) {
      case 'status_notify':
        toast.info(`User ${msg.user_first_name} is now ${msg.status}.`);
        break;

      case 'new_message_notification':
        toast.info(`New message from ${msg.sender_first_name}.`);
        setIndividualMessages((prevMessages) => {
          const existingConversation = prevMessages.find(
            (conv) => conv.id === msg.sender_id,
          );

          if (existingConversation) {
            return prevMessages.map((conv) =>
              conv.id === msg.sender_id
                ? {
                    ...conv,
                    last_message: msg,
                    unread_count: (conv.unread_count || 0) + 1,
                  }
                : conv,
            );
          } else {
            return [
              ...prevMessages,
              {
                id: msg.sender_id,
                first_name: msg.sender_first_name,
                last_message: msg,
                unread_count: 1,
              },
            ];
          }
        });

        break;
      case 'typing_indicator':
        toast.info(`User ${msg.user_id} is typing.`);

        setIndividualMessages((prevMessages) => {
          const existingConversation = prevMessages.find(
            (conv) => conv.id === msg.user_id,
          );

          if (existingConversation) {
            const originalContent = existingConversation.last_message.content;
            return prevMessages.map((conv) =>
              conv.id === msg.user_id
                ? {
                    ...conv,
                    last_message: {
                      ...conv.last_message,
                      content: 'Typing...',
                      originalContent, // Save the original content
                    },
                    unread_count: conv.unread_count,
                  }
                : conv,
            );
          } else {
            return [
              ...prevMessages,
              {
                id: msg.user_id,
                first_name: msg.user_first_name,
                last_message: {
                  content: 'Typing...',
                  originalContent: '', // For a new conversation, there's no previous content
                  timestamp: Date.now(),
                },
                unread_count: 1,
              },
            ];
          }
        });

        // Restore the original content after 5 seconds
        setTimeout(() => {
          setIndividualMessages((prevMessages) => {
            return prevMessages.map((conv) =>
              conv.id === msg.user_id
                ? {
                    ...conv,
                    last_message: {
                      ...conv.last_message,
                      content:
                        conv.last_message.originalContent ||
                        conv.last_message.content,
                    },
                  }
                : conv,
            );
          });
        }, 5000);
        break;

      default:
        console.error('Unknown message type:', message.type);
    }
  }, []);

  useChatWebSocket(socketUrl, handleNotification);

  const handleGenerateRoomId = useCallback((receiverId) => {
    try {
      const receiverIdStr = String(receiverId);
      const currentUserIdStr = String(currentUser);
      const { BigInt } = window;
      const bigintReceiver = BigInt(`0x${receiverIdStr.replace(/-/g, '')}`);
      const bigintCurrentUser = BigInt(`0x${currentUserIdStr.replace(/-/g, '')}`);
      const xorResult = bigintReceiver ^ bigintCurrentUser;
      const xorResultHex = xorResult.toString(16);
      const roomId = `${xorResultHex.substr(0, 8)}-${xorResultHex.substr(8, 4)}-${xorResultHex.substr(12, 4)}-${xorResultHex.substr(16, 4)}-${xorResultHex.substr(20)}`;
      handleSelectChat(roomId);
    } catch (error) {
      console.error('Error generating room ID:', error);
    }
  }, [currentUser, handleSelectChat]);

  const handleUserSelect = useCallback((user) => {
    setShowUserDropdown(false);
    handleGenerateRoomId(user.id);
    setIndividualMessages((prevMessages) => {
      const userExists = prevMessages.some((message) => message.id === user.id);
      if (userExists) {
        return prevMessages.map((message) =>
          message.id === user.id ? { ...message, unread_count: 0 } : message,
        );
      }
      return [
        ...prevMessages,
        {
          id: user.id,
          first_name: user.first_name,
          last_message: null,
          unread_count: 0,
          photo: user.photo,
          is_online: user.is_online || false,
        },
      ];
    });
  }, [handleGenerateRoomId]);

  const handleFriendshipRequest = async (userId) => {
    try {
      const response = await fetch('http://localhost:8000/chatMeetUp/friendship/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ to_user_id: userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Friendship request failed');
      }

      const result = await response.json();
      toast.success(result.message || 'Friendship request sent successfully!');
    } catch (error) {
      console.error('Friendship request error:', error);
      toast.error(`Error: ${error.message || 'An error occurred.'}`);
    }
  };

  const filteredIndividualMessages = useMemo(
    () => Array.isArray(individualMessages) ? individualMessages.filter((user) => user.first_name?.toLowerCase().includes(searchQuery.toLowerCase())) : [],
    [individualMessages, searchQuery]
  );

  const filteredGroupMessages = useMemo(
    () => Array.isArray(groupMessages) ? groupMessages.filter((room) => room.name?.toLowerCase().includes(searchQuery.toLowerCase())) : [],
    [groupMessages, searchQuery]
  );

  const totalFilteredMessages = useMemo(
    () => (filteredIndividualMessages.length || 0) + (filteredGroupMessages.length || 0),
    [filteredIndividualMessages, filteredGroupMessages]
  );

  const filteredUsers = useMemo(
    () => users?.filter((user) => user.id !== currentUser),
    [users, currentUser]
  );

  return (
    <Container fluid className="messages-container">
      <Row>
        <Col md={4} className="messages-list">
          <Header
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setShowUserDropdown={setShowUserDropdown}
            totalFilteredMessages={totalFilteredMessages}
          />
          {loadingIndividual || loadingGroup ? (
            <div className="loading-spinner">
              <Spinner animation="border" />
            </div>
          ) : errorIndividual || errorGroup ? (
            <Alert variant="danger">
              {errorIndividual?.message || errorGroup?.message || 'An error occurred while fetching messages'}
            </Alert>
          ) : (
            <MessageList
              filteredIndividualMessages={filteredIndividualMessages}
              filteredGroupMessages={filteredGroupMessages}
              handleGenerateRoomId={handleGenerateRoomId}
              handleSelectChat={handleSelectChat}
              selectedRoom={selectedRoom}
            />
          )}
        </Col>
        <Col md={8} className="chat-window">
          {selectedRoom ? (
            <ChatWindow roomId={selectedRoom} accessToken={accessToken} />
          ) : (
            <div className="no-chat-selected">
              Select a chat to start messaging
            </div>
          )}
        </Col>
      </Row>
      <UserModal
        showUserDropdown={showUserDropdown}
        setShowUserDropdown={setShowUserDropdown}
        loadingUsers={loadingUsers}
        errorUsers={errorUsers}
        filteredUsers={filteredUsers}
        handleUserSelect={handleUserSelect}
        handleFriendshipRequest={handleFriendshipRequest}
      />
      <ToastContainer />
    </Container>
  );
};

export default HomeChat;
