import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ListGroup,
  InputGroup,
  FormControl,
  Button,
  Dropdown,
  DropdownButton,
} from 'react-bootstrap';
import './ChatRoom.css';
import { v4 as uuidv4 } from 'uuid'; // Import uuidv4 function
import Message from '../assets/images/message/message.png';
import Profilephoto1 from '../assets/images/message/profilephoto1.png';
import Profilephoto2 from '../assets/images/message/profilephoto2.png';
import { jwtDecode } from 'jwt-decode'; // Importing named export


const MessageSidebar = ({ initialRoomId, initialRoomType, onRoomSelect }) => {
  const [conversations, setConversations] = useState([]);
  const [chatRooms, setChatRooms] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState('Newest');
  const [selectedRoomId, setSelectedRoomId] = useState(initialRoomId);
  const [selectedRoomType, setSelectedRoomType] = useState(initialRoomType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    fetchChatRooms();
    fetchConversations();
  }, [selectedRoomId, selectedRoomType]);

  const fetchChatRooms = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        'http://localhost:8000/chatMeetUp/chatrooms/',
      );
      setChatRooms(response.data);
      setLoading(false);
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const access_token = localStorage.getItem('access_token');
      const config = {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      };

      const response = await axios.get(
        'http://localhost:8000/chatMeetUp/Conversations/',
        config,
      );
      setConversations(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError('Error fetching conversations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddButtonClick = () => {
    fetchAllUsers();
  };

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/api/auth/users');
      const users = response.data;
      setUsers(users);
      setShowUserDropdown(true);
    } catch (error) {
      console.error('Error fetching all users:', error);
      setError('Error fetching all users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user) => {
    setShowUserDropdown(false);
    handleClick(user.id); // Pass user ID to handleClick
  };

  const onMessageReceived = (message) => {
    if (message.roomId === selectedRoomId) {
      setChatMessages((prevMessages) => [...prevMessages, message]);
    }
  };

  const onRoomNameReceived = (name) => {
    // This function might not be needed in the new design
  };

 /* eslint-disable no-undef */
const handleClick = (receiverId) => {
  const accessToken = localStorage.getItem('access_token');
  if (accessToken) {
    try {
      const decodedToken = jwtDecode(accessToken);
      const user1_id = decodedToken.user_id;

      // Ensure receiverId and user1_id are strings
      const receiverIdStr = String(receiverId);
      const user1IdStr = String(user1_id);

      // Convert UUID strings to BigInt for XOR operation
      const bigintReceiver = BigInt(`0x${receiverIdStr.replace(/-/g, '')}`);
      const bigintUser1 = BigInt(`0x${user1IdStr.replace(/-/g, '')}`);

      // XOR operation
      const xorResult = bigintReceiver ^ bigintUser1;

      // Convert the result back to a UUID string format
      const xorResultHex = xorResult.toString(16);
      const roomId = `${xorResultHex.substr(0, 8)}-${xorResultHex.substr(8, 4)}-${xorResultHex.substr(12, 4)}-${xorResultHex.substr(16, 4)}-${xorResultHex.substr(20)}`;

      console.log('user1_id', user1_id);
      console.log('receiverId', receiverId);
      console.log('receiverIdStr', receiverIdStr);
      console.log('user1IdStr', user1IdStr);
      console.log('roomId', roomId);

      onRoomSelect(roomId);
    } catch (error) {
      console.error('Error decoding access token:', error);
    }
  } else {
    console.error('Access token not found');
  }
};
/* eslint-enable no-undef */


  const handleRoomSelect = (roomId) => {
    setSelectedRoomId(roomId);
    setSelectedRoomType('chatroom');
    setChatMessages([]); // Clear chat messages when selecting a new room
    onRoomSelect(roomId, 'chatroom');
  };

  const handleSearchInputChange = (e) => {
    setSearchInput(e.target.value);
  };

  const handleSortChange = (sortOption) => {
    setSortBy(sortOption);
    setConversations((prevConversations) => {
      const sortedConversations = [...prevConversations];
      sortedConversations.sort((a, b) => {
        if (sortOption === 'Newest') {
          return new Date(b.timestamp) - new Date(a.timestamp);
        } else {
          return new Date(a.timestamp) - new Date(b.timestamp);
        }
      });
      return sortedConversations;
    });
  };

  return (
    <div className="chat-container">
      <div className="messages-list">
        <div className="header-container">
          <div className="messages-header">
            <p>
              Messages{' '}
              <span className="message-count">{conversations.length}</span>
            </p>
          </div>
          <InputGroup className="search-input-group">
            <FormControl
              placeholder="Search"
              aria-label="Search"
              aria-describedby="basic-addon2"
              value={searchInput}
              onChange={handleSearchInputChange}
            />
            <Button
              variant="outline-secondary"
              id="button-addon2"
              className="add-button"
              onClick={handleAddButtonClick}
            >
              +
            </Button>
            {showUserDropdown && (
              <DropdownButton
                id="user-dropdown"
                title="Select User"
                className="user-dropdown"
              >
                {users.map((user) => (
                  <Dropdown.Item
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                  >
                    {user.first_name}
                  </Dropdown.Item>
                ))}
              </DropdownButton>
            )}
          </InputGroup>
          <div className="message-sort-dropdown">
            <span>Sort by </span>
            <Dropdown>
              <Dropdown.Toggle
                variant="link"
                id="dropdown-basic"
                className="message-dropdown-toggle"
              >
                {sortBy}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => handleSortChange('Newest')}>
                  Newest
                </Dropdown.Item>
                <Dropdown.Item onClick={() => handleSortChange('Oldest')}>
                  Oldest
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
          <div className="all-messages">
            <img src={Message} className="message-img" alt="logo" />
            <p>ALL MESSAGES</p>
          </div>
        </div>

        <h5>Direct Messages</h5>
        <ListGroup>
          {loading ? (
            <div>Loading conversations...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : (
            conversations.map((conversation, index) => (
              <ListGroup.Item
                key={conversation.id}
                action
                onClick={() => handleClick(conversation.id)}
              >
                <img
                  src={index % 2 === 0 ? Profilephoto1 : Profilephoto2}
                  alt={conversation.first_name}
                  className="profile-img"
                />
                {conversation.first_name}{' '}
                <span className="subtext">
                  {conversation.last_message.content}{' '}
                </span>
                <span className="time-text">
                  {conversation.timestamp &&
                    new Date(conversation.timestamp).toLocaleTimeString()}
                </span>
              </ListGroup.Item>
            ))
          )}
        </ListGroup>

        <h5 className="mt-4">Chat Rooms</h5>
        {loading ? (
          <div>Loading chat rooms...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          <ListGroup>
            {chatRooms.map((chatRoom) => (
              <ListGroup.Item
                key={chatRoom.id}
                action
                onClick={() => handleRoomSelect(chatRoom.id)}
              >
                <div className="chat-room">
                  <h6>{chatRoom.name}</h6>
                  <p className="mb-0">{chatRoom.description}</p>
                  <small>ID: {chatRoom.id}</small>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </div>
    </div>
  );
};

export default MessageSidebar;
