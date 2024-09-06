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
import { jwtDecode } from 'jwt-decode';
import debounce from 'lodash.debounce';
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
  updateStatus,
} from '../actions/messageActions';
import {
  selectIndividualMessages,
  selectGroupMessages,
  selectLoading,
  selectError,
  selectTypingIndicators,
} from '../selectors/messageSelectors';
const apiUrl = process.env.REACT_APP_API_URL;
const HomeChat = () => {
  const dispatch = useDispatch();

  // Selectors using reselect
  const individualMessages = useSelector(selectIndividualMessages);
  const groupMessages = useSelector(selectGroupMessages);
  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);
  const typingIndicators = useSelector(selectTypingIndicators);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const typingTimeouts = useRef({});
  const accessToken = localStorage.getItem('access_token');

  // Decode current user from JWT token
  const currentUser = useMemo(() => {
    if (!accessToken) return null;
    try {
      return jwtDecode(accessToken)?.user_id || null;
    } catch (error) {
      console.error('Error decoding access token:', error);
      return null;
    }
  }, [accessToken]);

  // Fetch config with authorization header
  const fetchConfig = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    [accessToken],
  );

  // Fetch messages and users data
  const {
    data: fetchedIndividualMessages = { partners: [] },
    loading: loadingIndividual,
    error: errorIndividual,
    retry: retryIndividual,
  } = useFetch(`${apiUrl}/chatMeetUp/conversations/`, fetchConfig);

  const {
    data: fetchedGroupMessages = [],
    loading: loadingGroup,
    error: errorGroup,
    retry: retryGroup,
  } = useFetch(`${apiUrl}/chatMeetUp/chatrooms/`, fetchConfig);

  const {
    data: users = [],
    loading: loadingUsers,
    error: errorUsers,
    retry: retryUsers,
  } = useFetch(`${apiUrl}/api/auth/users`, fetchConfig);

  // Set current user in Redux state
  useEffect(() => {
    if (currentUser) {
      dispatch(setCurrentUser(currentUser));
    }
  }, [currentUser, dispatch]);

  // Handle loading, error, and fetched data
  useEffect(() => {
    if (fetchedIndividualMessages && fetchedIndividualMessages.partners) {
    
      dispatch(setIndividualMessages(fetchedIndividualMessages.partners));
    }

    dispatch(setLoading(loadingIndividual || loadingGroup || loadingUsers));
    dispatch(setGroupMessages(fetchedGroupMessages));
    dispatch(setUsers(users));

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


  // Filter messages based on search query
  const filteredIndividualMessages = useMemo(() => {
    return individualMessages.filter((user) =>
      user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [individualMessages, searchQuery]);

  const filteredGroupMessages = useMemo(() => {
    return groupMessages.filter((room) =>
      room.name?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [groupMessages, searchQuery]);

  // Handle typing indicators and notifications
  const handleNotification = useCallback(
    (message) => {
      const { type, message: msg } = message;

      switch (type) {
        case 'status_notify':
          toast.info(`User ${msg.user_first_name} is now ${msg.status}.`);
          dispatch(updateStatus(msg.sender_id, msg.status));
          break;

        case 'new_message_notification':
          toast.info(`New message from ${msg.sender_first_name}.`);
          dispatch(updateMessages(message));
          break;

        case 'typing_indicator': {
          const user_id = msg.sender_id;

          if (!user_id) {
            console.error('User ID is missing in typing indicator message');
            return;
          }

          // Dispatch the action to set the typing indicator
          dispatch(setTypingIndicator({ userId: user_id, isTyping: true }));

          // Set a timeout to automatically reset the typing indicator after 5 seconds
          setTimeout(() => {
            dispatch(resetTypingIndicator(user_id));
          }, 3000);

          break;
        }

        default:
          console.error('Unknown message type:', type);
      }
    },
    [dispatch], // Ensure that dispatch is in the dependency array
  );


  useChatWebSocket(
    `ws://localhost:8000/ws/chat/?token=${accessToken}`,
    handleNotification,
    !!accessToken,
  );

  // Cleanup typing timeouts when the component unmounts
  useEffect(() => {
    const timeouts = typingTimeouts.current;

    return () => {
      Object.values(timeouts).forEach(clearTimeout);
    };
  }, []);


  // Handle selecting chat room
  const handleSelectChat = useCallback(
    (roomId, receiverId) => {
      setSelectedRoom(roomId);
      dispatch(selectRoom(roomId));
      dispatch(clearUnreadCount(receiverId));
    },
    [dispatch],
  );

  // Handle friendship request
  const handleFriendshipRequest = async (userId) => {
    try {
      const response = await fetch(`${apiUrl}/chatMeetUp/friendship/`, {
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

  // Retry fetching data on failure
  const retryFetch = useCallback(() => {
    dispatch(setLoading(true));
    retryIndividual();
    retryGroup();
    retryUsers();
  }, [dispatch, retryIndividual, retryGroup, retryUsers]);

  // Filter users to exclude the current user
  const filteredUsers = useMemo(
    () => users?.filter((user) => user.id !== currentUser),
    [users, currentUser],
  );

  // Debounced search
  const handleSearch = debounce((value) => setSearchQuery(value), 300);


  return (
    <Container fluid className="messages-container">
      <Header
        searchQuery={searchQuery}
        setSearchQuery={handleSearch}
        setShowUserDropdown={setShowUserDropdown}
      />
      <Row>
        <Col md={4} className="messages-list">
          {loading ? (
            <Spinner animation="border" variant="primary" />
          ) : error ? (
            <Alert variant="danger">
              Error loading messages.{' '}
              <button className="btn btn-link" onClick={retryFetch}>
                Retry
              </button>
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
