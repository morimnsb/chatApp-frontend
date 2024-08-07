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
import Message from '../assets/images/message/message.png';
import ChatWindow from './ChatWindow';
import {jwtDecode} from 'jwt-decode';
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
    if (fetchedIndividualMessages) {
      setIndividualMessages(fetchedIndividualMessages);
    }
    if (fetchedGroupMessages) {
      setGroupMessages(fetchedGroupMessages);
    }
  }, [fetchedIndividualMessages, fetchedGroupMessages]);

  const handleNotification = useCallback((message) => {
    console.log(message)
    switch (message.type) {
      case 'status_notify':
        toast.info(
          `User ${message.message.user_first_name} is now ${message.message.status}.`,
        );
        break;

      case 'new_message_notification':
        toast.info(`New message from ${message.message.sender_first_name}.`);
        // updateUnreadCount(message.message.sender_id);
        
        setIndividualMessages((prevMessages) => {
          const existingConversation = prevMessages.find(
            (conv) => conv.id === message.message.sender_id
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

  // const updateUnreadCount = (senderId) => {
  //   setIndividualMessages((prevMessages) =>
  //     prevMessages.map((user) =>
  //       user.id === senderId
  //         ? { ...user, unread_count: (user.unread_count || 0) + 1 }
  //         : user,
  //     ),
  //   );
  // };

  useChatWebSocket(socketUrl, handleNotification);

  const handleGenerateRoomId = useCallback(
    (receiverId) => {
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
  }, [currentUser]);

  const handleSelectChat = useCallback((roomId) => {
    setSelectedRoom(roomId);
  }, []);

  const handleUserSelect = useCallback(
    (user) => {
      setShowUserDropdown(false);

      // Generate room ID for the selected user
      handleGenerateRoomId(user.id);

      // Update the individual messages list
      setIndividualMessages((prevMessages) => {
        // Check if the user is already in the list
      const userExists = prevMessages.some((message) => message.id === user.id);

        // If the user exists, update the unread_count
        if (userExists) {
          return prevMessages.map((message) =>
            message.id === user.id
              ? { ...message, unread_count: 0 } // Set unread_count to 0 for the selected user
            : message
          );
        }

        // If the user is not in the list, add them
        return [
          ...prevMessages,
          {
            id: user.id,
            first_name: user.first_name,
            last_message: null, // Initialize as per your requirement
          unread_count: 0,   // Initialize unread_count to 0 for a new user
            photo: user.photo, // Assuming photo is part of the user object
            is_online: user.is_online || false, // Initialize is_online if it's part of the user object
          },
        ];
      });
    },
  [handleGenerateRoomId]
  );



  const filteredIndividualMessages = useMemo(() => individualMessages?.filter((user) =>
    user.first_name?.toLowerCase().includes(searchQuery.toLowerCase())
  ), [individualMessages, searchQuery]);

  const filteredGroupMessages = useMemo(() => groupMessages?.filter((room) =>
    room.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ), [groupMessages, searchQuery]);

  const totalFilteredMessages = useMemo(() => 
      (filteredIndividualMessages?.length || 0) +
      (filteredGroupMessages?.length || 0),
  [filteredIndividualMessages, filteredGroupMessages]);

  const filteredUsers = useMemo(() => users?.filter((user) => user.id !== currentUser), [users, currentUser]);

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
      />
      <ToastContainer />
    </Container>
  );
};

export default MessagesList;
