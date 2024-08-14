import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ListGroup,
  InputGroup,
  FormControl,
  Button,
  Dropdown,
  Spinner,
  Alert,
  Modal,
  Container,
  Row,
  Col,
} from 'react-bootstrap';
import './MessagesList.css';
import ChatWindow from './ChatWindow';
import { jwtDecode } from 'jwt-decode';
import useChatWebSocket from './useChatWebSocket';
import useFetch from './useFetch';
import { ToastContainer, toast } from 'react-toastify';
import Header from './Header';
import MessageList from './MessageList';
import UserModal from './UserModal';
import 'react-toastify/dist/ReactToastify.css';

const MessagesList = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [individualMessages, setIndividualMessages] = useState([]);
  const [groupMessages, setGroupMessages] = useState([]);

  const accessToken = localStorage.getItem('access_token');
  const currentUser = useMemo(() => {
    try {
      return jwtDecode(accessToken)?.user_id;
    } catch (error) {
      console.error('Error decoding access token:', error);
      return null;
    }
  }, [accessToken]);

  const socketUrl = `ws://localhost:8000/ws/chat/?token=${accessToken}`;

  const {
    data: fetchedIndividualMessages,
    loading: loadingIndividual,
    error: errorIndividual,
  } = useFetch('http://localhost:8000/chatMeetUp/Conversations/', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

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
    if (
      fetchedIndividualMessages?.partners &&
      Array.isArray(fetchedIndividualMessages.partners)
    ) {
      setIndividualMessages(fetchedIndividualMessages.partners);
      console.log(
        'Fetched individual messages:',
        fetchedIndividualMessages.partners,
      ); // Log fetched messages
    }

    if (Array.isArray(fetchedGroupMessages)) {
      setGroupMessages(fetchedGroupMessages);
      console.log('Fetched group messages:', fetchedGroupMessages); // Log fetched group messages
    }
  }, [fetchedIndividualMessages, fetchedGroupMessages]);


  const handleNotification = useCallback((message) => {
    switch (message.type) {
      case 'status_notify':
        toast.info(
          `User ${message.message.user_first_name} is now ${message.message.status}.`,
        );
        break;

      case 'new_message_notification':
        toast.info(`New message from ${message.message.sender_first_name}.`);
        setIndividualMessages((prevMessages) => {
          const existingConversation = prevMessages.find(
            (conv) => conv.id === message.message.sender_id,
          );

          if (existingConversation) {
            return prevMessages.map((conv) =>
              conv.id === message.message.sender_id
                ? {
                    ...conv,
                    last_message: message.message,
                    unread_count: (conv.unread_count || 0) + 1,
                  }
                : conv,
            );
          } else {
            return [
              ...prevMessages,
              {
                id: message.message.sender_id,
                first_name: message.message.sender_first_name,
                last_message: message.message,
                unread_count: 1,
              },
            ];
          }
        });
        break;

      default:
        toast.info(`New message from ${message.message.sender_first_name}.`);
    }
  }, []);

  useChatWebSocket(socketUrl, handleNotification);

  const handleGenerateRoomId = useCallback(
    (receiverId) => {
      try {
        const receiverIdStr = String(receiverId);
        const currentUserIdStr = String(currentUser);
        const { BigInt } = window;
        const bigintReceiver = BigInt(`0x${receiverIdStr.replace(/-/g, '')}`);
        const bigintCurrentUser = BigInt(
          `0x${currentUserIdStr.replace(/-/g, '')}`,
        );
        const xorResult = bigintReceiver ^ bigintCurrentUser;
        const xorResultHex = xorResult.toString(16);
        const roomId = `${xorResultHex.substr(0, 8)}-${xorResultHex.substr(
          8,
          4,
        )}-${xorResultHex.substr(12, 4)}-${xorResultHex.substr(
          16,
          4,
        )}-${xorResultHex.substr(20)}`;
        handleSelectChat(roomId);
      } catch (error) {
        console.error('Error generating room ID:', error);
      }
    },
    [currentUser],
  );

  const handleSelectChat = useCallback((roomId) => {
    setSelectedRoom(roomId);
  }, []);

  const handleUserSelect = useCallback(
    (user) => {
      setShowUserDropdown(false);
      handleGenerateRoomId(user.id);
      setIndividualMessages((prevMessages) => {
        const userExists = prevMessages.some(
          (message) => message.id === user.id,
        );
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
    },
    [handleGenerateRoomId],
  );

  const handleFriendshipRequest = async (userId) => {
    try {
      const response = await fetch(
        'http://localhost:8000/chatMeetUp/friendship/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ to_user_id: userId }), // Ensure this matches the backend expectation
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Friendship request failed');
      }

      const result = await response.json();
      toast.success(result.message || 'Friendship request sent successfully!');
      console.log(result.message);
    } catch (error) {
      console.error('Friendship request error:', error);
      toast.error(
        error.message || 'An error occurred while sending the request.',
      );
    }
  };

  const filteredIndividualMessages = useMemo(
    () =>
      Array.isArray(individualMessages)
        ? individualMessages.filter((user) =>
            user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : [],
    [individualMessages, searchQuery],
  );

  const filteredGroupMessages = useMemo(
    () =>
      Array.isArray(groupMessages)
        ? groupMessages.filter((room) =>
            room.name?.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : [],
    [groupMessages, searchQuery],
  );

  const totalFilteredMessages = useMemo(
    () =>
      (filteredIndividualMessages.length || 0) +
      (filteredGroupMessages.length || 0),
    [filteredIndividualMessages, filteredGroupMessages],
  );

  const filteredUsers = useMemo(
    () => users?.filter((user) => user.id !== currentUser),
    [users, currentUser],
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
              {errorIndividual?.message ||
                errorGroup?.message ||
                'An error occurred while fetching messages'}
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
        handleFriendshipRequest={handleFriendshipRequest} // Ensure this is passed
      />

      <ToastContainer />
    </Container>
  );
};

export default MessagesList;
