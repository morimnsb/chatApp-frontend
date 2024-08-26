import React, { useState, useReducer, useCallback, useMemo, useEffect } from 'react';
import { messageReducer, messageActionTypes } from './messageReducer'; // Adjust path as needed
import { Container, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { jwtDecode } from 'jwt-decode'; // Corrected import
import useChatWebSocket from './useChatWebSocket';
import useFetch from './useFetch';
import MessageList from './MessageList';
import ChatWindow from './ChatWindow';
import Header from './Header';
import UserModal from './UserModal';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './HomeChat.css';

const initialState = {
  individualMessages: [], // Ensure this matches what your reducer expects
  // other state properties if needed
};

const HomeChat = () => {
  const [state, dispatch] = useReducer(messageReducer, initialState);
  const { individualMessages } = state; // Access state from reducer

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const accessToken = localStorage.getItem('access_token');
  const currentUser = useMemo(() => {
    try {
      return jwtDecode(accessToken)?.user_id || null;
    } catch (error) {
      console.error('Error decoding access token:', error);
      return null;
    }
  }, [accessToken]);

  const fetchConfig = useMemo(
    () => ({ headers: { Authorization: `Bearer ${accessToken}` } }),
    [accessToken],
  );

  const {
    data: fetchedIndividualMessages = { partners: [] },
    loading: loadingIndividual,
    error: errorIndividual,
    retry: retryIndividual,
  } = useFetch('http://localhost:8000/chatMeetUp/conversations/', fetchConfig);

  const {
    data: fetchedGroupMessages = [],
    loading: loadingGroup,
    error: errorGroup,
    retry: retryGroup,
  } = useFetch('http://localhost:8000/chatMeetUp/chatrooms/', fetchConfig);

  const {
    data: users = [],
    loading: loadingUsers,
    error: errorUsers,
    retry: retryUsers,
  } = useFetch('http://localhost:8000/api/auth/users', fetchConfig);

  // Synchronize fetched messages with reducer state
  useEffect(() => {
    if (fetchedIndividualMessages && Array.isArray(fetchedIndividualMessages.partners)) {
      dispatch({
        type: messageActionTypes.SET_INDIVIDUAL_MESSAGES,
        payload: fetchedIndividualMessages.partners,
      });
    }
  }, [fetchedIndividualMessages]);

  const filteredIndividualMessages = useMemo(() => {
    if (Array.isArray(individualMessages)) {
      console.log('Filtering individual messages...');
      return individualMessages.filter((user) =>
        user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    } else {
      console.warn(
        'individualMessages is not an array or is null:',
        individualMessages,
      );
      return [];
    }
  }, [individualMessages, searchQuery]);

  const filteredGroupMessages = useMemo(() => {
    if (Array.isArray(fetchedGroupMessages)) {
      console.log('Filtering group messages...');
      return fetchedGroupMessages.filter((room) =>
        room.name?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    } else {
      console.warn(
        'fetchedGroupMessages is not an array or is null:',
        fetchedGroupMessages,
      );
      return [];
    }
  }, [fetchedGroupMessages, searchQuery]);

  const handleNotification = useCallback((message) => {
    const { type, message: msg } = message;
    console.log('WebSocket message received:', message);

    switch (type) {
      case 'status_notify':
        toast.info(`User ${msg.user_first_name} is now ${msg.status}.`);
        dispatch({
          type: messageActionTypes.UPDATE_MESSAGES,
          payload: { msg, isStatus: true },
        });
        console.log("msg",msg)
        break;
      case 'new_message_notification':
        toast.info(`New message from ${msg.sender_first_name}.`);
        dispatch({
          type: messageActionTypes.UPDATE_MESSAGES,
          payload: { msg },
        });
        break;
      case 'typing_indicator':
        toast.info(`User ${msg.sender_id} is typing.`);
        dispatch({
          type: messageActionTypes.UPDATE_MESSAGES,
          payload: { msg, isTyping: true },
        });
        setTimeout(() => {
          dispatch({
            type: messageActionTypes.RESET_TYPING_INDICATOR,
            payload: msg.sender_id,
          });
        }, 5000);
        break;
      default:
        console.error('Unknown message type:', type);
    }
  }, []);

  useChatWebSocket(
    `ws://localhost:8000/ws/chat/?token=${accessToken}`,
    handleNotification,
    true,
  );

  const handleSelectChat = useCallback(
    (roomId) => {
      setSelectedRoom(roomId);
    },
    [setSelectedRoom],
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
          body: JSON.stringify({ to_user_id: userId }),
        },
      );

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


  const retryFetch = useCallback(() => {
    retryIndividual();
    retryGroup();
    retryUsers();
  }, [retryIndividual, retryGroup, retryUsers]);

  const filteredUsers = useMemo(
    () => users?.filter((user) => user.id !== currentUser),
    [users, currentUser],
  );

  return (
    <Container fluid className="messages-container">
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setShowUserDropdown={setShowUserDropdown}
      />
      <Row>
        <Col md={4} className="messages-list">
          {loadingIndividual || loadingGroup ? (
            <Spinner animation="border" variant="primary" />
          ) : errorIndividual || errorGroup ? (
            <Alert variant="danger">
              Error loading messages.{' '}
              <button onClick={retryFetch}>Retry</button>
            </Alert>
          ) : (
            <MessageList
              filteredIndividualMessages={filteredIndividualMessages}
              filteredGroupMessages={filteredGroupMessages}
              handleSelectChat={handleSelectChat}
              selectedRoom={selectedRoom}
              currentUser={currentUser}
            />
          )}
        </Col>
        <Col md={8}>
          {selectedRoom && (
            <ChatWindow
              roomId={selectedRoom}
              individualMessages={filteredIndividualMessages} // Pass filtered data
              groupMessages={filteredGroupMessages}
            />
          )}
        </Col>
      </Row>
      <UserModal
        showUserDropdown={showUserDropdown}
        setShowUserDropdown={setShowUserDropdown}
        loadingUsers={loadingUsers}
        errorUsers={errorUsers}
        currentUser={currentUser}
        filteredUsers={filteredUsers}
        handleSelectChat={handleSelectChat}
        handleFriendshipRequest={handleFriendshipRequest}
      />
      <ToastContainer />
    </Container>
  );
};

export default HomeChat;
