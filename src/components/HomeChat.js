import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Container, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import {jwtDecode} from 'jwt-decode';
import useChatWebSocket from '../hooks/useChatWebSocket';
import useFetch from '../hooks/useFetch';
import MessageList from './MessageList';
import ChatWindow from './ChatWindow';
import Header from './Header';
import UserModal from './UserModal';
import 'react-toastify/dist/ReactToastify.css';
import './HomeChat.css';
import {
  setCurrentUser,
  setUsers,
  setIndividualMessages,
  setGroupMessages,
  selectRoom,
  updateMessages,
  setLoading,
  setError,
  setTypingIndicator,
  clearUnreadCount,
  resetTypingIndicator,
  updateLastMessage,
} from '../actions/messageActions';

const HomeChat = () => {
  const dispatch = useDispatch();
  const individualMessages = useSelector(
    (state) => state.messages.individualMessages,
  );
  const groupMessages = useSelector((state) => state.messages.groupMessages);
  const loading = useSelector((state) => state.messages.loading);
  const error = useSelector((state) => state.messages.error);
  const typingIndicators = useSelector(
    (state) => state.messages.typingIndicators,
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const typingTimeouts = useRef({});
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
    () => ({
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
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

  useEffect(() => {
    if (currentUser) {
      dispatch(setCurrentUser(currentUser));
    }
  }, [currentUser, dispatch]);

  useEffect(() => {
    dispatch(setLoading(loadingIndividual || loadingGroup || loadingUsers));

    if (
      fetchedIndividualMessages &&
      Array.isArray(fetchedIndividualMessages.partners)
    ) {
      dispatch(setIndividualMessages(fetchedIndividualMessages.partners));
    }

    if (fetchedGroupMessages && Array.isArray(fetchedGroupMessages)) {
      dispatch(setGroupMessages(fetchedGroupMessages));
    }

    if (users && Array.isArray(users)) {
      dispatch(setUsers(users));
    }

    if (errorIndividual || errorGroup || errorUsers) {
      dispatch(setError(errorIndividual || errorGroup || errorUsers));
    }
  }, [
    fetchedIndividualMessages,
    fetchedGroupMessages,
    users,
    loadingIndividual,
    loadingGroup,
    loadingUsers,
    errorIndividual,
    errorGroup,
    errorUsers,
    dispatch,
  ]);

  const filteredIndividualMessages = useMemo(
    () =>
      individualMessages.filter((user) =>
        user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [individualMessages, searchQuery],
  );

  const filteredGroupMessages = useMemo(() => {
    if (Array.isArray(fetchedGroupMessages)) {
      return fetchedGroupMessages.filter((room) =>
        room.name?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    } else {
      console.log(
        'fetchedGroupMessages is not an array or is null:',
        fetchedGroupMessages,
      );
      return [];
    }
  }, [fetchedGroupMessages, searchQuery]);

  const handleNotification = useCallback(
    (message) => {
      const { type, message: msg } = message;

      switch (type) {
        case 'status_notify':
          toast.info(`User ${msg.user_first_name} is now ${msg.status}.`);
          dispatch(updateMessages(msg, false, true));
          break;

        case 'new_message_notification':
          toast.info(`New message from ${msg.sender_first_name}.`);
          dispatch(updateMessages(msg, false, false));
          break;

        case 'typing_indicator':
          const user_id = msg.sender_id;

          if (!user_id) {
            console.error('User ID is missing in typing indicator message');
            return;
          }

          if (typingTimeouts.current[user_id]) {
            clearTimeout(typingTimeouts.current[user_id]);
          }

          dispatch(setTypingIndicator({ userId: user_id, isTyping: true }));

          typingTimeouts.current[user_id] = setTimeout(() => {
            dispatch(resetTypingIndicator(user_id));
            delete typingTimeouts.current[user_id];
          }, 5000);
          break;

        case 'update_last_message':
          dispatch(
            updateLastMessage({
              sender_id: msg.sender_id,
              lastMessage: msg.lastMessage,
            }),
          );
          break;

        default:
          console.error('Unknown message type:', type);
      }
    },
    [dispatch],
  );

  useChatWebSocket(
    `ws://localhost:8000/ws/chat/?token=${accessToken}`,
    handleNotification,
    !!accessToken,
  );

  const handleSelectChat = useCallback(
    (roomId, receiverId) => {
      setSelectedRoom(roomId);
      dispatch(selectRoom(roomId));
      dispatch(clearUnreadCount(receiverId));
    },
    [dispatch],
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
    dispatch(setLoading(true));
    retryIndividual();
    retryGroup();
    retryUsers();
  }, [dispatch, retryIndividual, retryGroup, retryUsers]);

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
          {loading ? (
            <Spinner animation="border" variant="primary" />
          ) : error ? (
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
              typingIndicators={typingIndicators}
            />
          )}
        </Col>
        <Col md={8}>
          {selectedRoom && (
            <ChatWindow
              roomId={selectedRoom}
              individualMessages={filteredIndividualMessages}
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
