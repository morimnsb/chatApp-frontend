import React, { useState, useCallback, useEffect } from 'react';
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
import { jwtDecode } from 'jwt-decode';
import useChatWebSocket from './useChatWebSocket';
import useFetch from './useFetch';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const MessagesList = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const accessToken = localStorage.getItem('access_token');
  let decodedToken;

  try {
    decodedToken = jwtDecode(accessToken);
  } catch (error) {
    console.error('Error decoding access token:', error);
  }

  const currentUser = decodedToken?.user_id;
  const socketUrl = `ws://localhost:8000/ws/chat/?token=${accessToken}`;

  useEffect(() => {
    console.log('Attempting to connect to WebSocket with URL:', socketUrl);
  }, [socketUrl]);

  const {
    data: individualMessages,
    loading: loadingIndividual,
    error: errorIndividual,
  } = useFetch('http://localhost:8000/chatMeetUp/Conversations/', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const {
    data: groupMessages,
    loading: loadingGroup,
    error: errorGroup,
  } = useFetch('http://localhost:8000/chatMeetUp/chatrooms/');

  const {
    data: users,
    loading: loadingUsers,
    error: errorUsers,
  } = useFetch('http://localhost:8000/api/auth/users');

  const handleNotification = useCallback((message) => {
    switch (message.type) {
      case 'user_online_notification':
        toast.info(`User ${message.message} is now online.`);
        break;
      case 'user_offline_notification':
        toast.info(`User ${message.message} is now offline.`);
        break;
      case 'new_message_notification':
        toast.info(`New message from ${message.message.sender_first_name}.`);
        
        break;
      default:
        toast.info(`New message from ${message.message.sender_first_name}.`);
    }
  }, []);

  useChatWebSocket(socketUrl, handleNotification);

  const handleGenerateRoomId = (receiverId) => {
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
  };

  const handleSelectChat = (roomId) => {
    setSelectedRoom(roomId);
  };

  const handleUserSelect = (user) => {
    setShowUserDropdown(false);
    handleGenerateRoomId(user.id);
  };

  const filteredIndividualMessages = individualMessages?.filter((user) =>
    user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredGroupMessages = groupMessages?.filter((room) =>
    room.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalFilteredMessages =
    (filteredIndividualMessages?.length || 0) +
    (filteredGroupMessages?.length || 0);

  const filteredUsers = users?.filter((user) => user.id !== currentUser);

  return (
    <Container fluid className="messages-container">
      <Row>
        <Col md={4} className="messages-list">
          <div className="header-container">
            <div className="messages-header">
              <p>
                Messages{' '}
                <span className="message-count">{totalFilteredMessages}</span>
              </p>
            </div>
            <InputGroup className="search-input-group">
              <FormControl
                placeholder="Search"
                aria-label="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button
                variant="outline-secondary"
                className="add-button"
                onClick={() => setShowUserDropdown(true)}
              >
                +
              </Button>
            </InputGroup>
            <div className="message-sort-dropdown">
              <span>Sort by </span>
              <Dropdown>
                <Dropdown.Toggle
                  variant="link"
                  id="dropdown-basic"
                  className="message-dropdown-toggle"
                >
                  Newest
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item href="#/action-1">Newest</Dropdown.Item>
                  <Dropdown.Item href="#/action-2">Oldest</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
            <div className="all-messages">
              <img src={Message} className="message-img" alt="logo" />
              <p>ALL MESSAGES</p>
            </div>
          </div>
          {loadingIndividual || loadingGroup ? (
            <div className="loading-spinner">
              <Spinner animation="border" />
            </div>
          ) : errorIndividual || errorGroup ? (
            <Alert variant="danger">
              {errorIndividual?.message || errorGroup?.message}
            </Alert>
          ) : (
            <ListGroup>
              <ListGroup.Item disabled className="list-group-header">
                INDIVIDUAL MESSAGES
              </ListGroup.Item>
              {filteredIndividualMessages.map((user, index) => (
                <ListGroup.Item
                  key={index}
                  action
                  active={selectedRoom === user.id}
                  onClick={() => handleGenerateRoomId(user.id)}
                >
                  <img
                    src={user.photo}
                    alt={user.first_name}
                    className="profile-img"
                  />
                  {user.first_name}{' '}
                  <span className="subtext">{user.last_message?.content}</span>
                  <span className="time-text">
                    {user.last_message?.timestamp}
                  </span>
                  {user.is_online && (
                    <span className="online-status">Online</span>
                  )}
                  <span className="unread_count">
                    {user.unread_count}
                  </span>
                </ListGroup.Item>
              ))}
              <ListGroup.Item disabled className="list-group-header">
                GROUP MESSAGES
              </ListGroup.Item>
              {filteredGroupMessages.map((room, index) => (
                <ListGroup.Item
                  key={index}
                  action
                  active={selectedRoom === room.id}
                  onClick={() => handleSelectChat(room.id)}
                >
                  <img
                    src={room.photo}
                    alt={room.name}
                    className="profile-img"
                  />
                  {room.name} <span className="subtext">{room.subtext}</span>
                  <span className="time-text">{room.time}</span>
                </ListGroup.Item>
              ))}
            </ListGroup>
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
      <Modal show={showUserDropdown} onHide={() => setShowUserDropdown(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Select a User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingUsers ? (
            <Spinner animation="border" />
          ) : errorUsers ? (
            <Alert variant="danger">{errorUsers.message}</Alert>
          ) : (
            filteredUsers.map((user, index) => (
              <ListGroup.Item
                key={index}
                action
                onClick={() => handleUserSelect(user)}
              >
                <img
                  src={user.photo}
                  alt={user.first_name}
                  className="profile-img"
                />
                {user.first_name} {user.last_name}
              </ListGroup.Item>
            ))
          )}
        </Modal.Body>
      </Modal>

      {/* ToastContainer for displaying notifications */}
      <ToastContainer />
    </Container>
  );
};

export default MessagesList;
