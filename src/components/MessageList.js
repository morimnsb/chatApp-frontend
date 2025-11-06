import React, { useMemo, useState } from 'react';
import { ListGroup, Button, Spinner } from 'react-bootstrap';
import axios from 'axios';
import useGenerateRoomId from '../hooks/useGenerateRoomId';
import { formatTime } from '../utils/formatTime';
import profilephoto1 from '../assets/images/message/profilephoto1.png';
import './MessageList.css';

const MessageList = ({
  filteredIndividualMessages,
  filteredGroupMessages,
  currentUser,
  handleSelectChat,
  selectedRoom,
  typingIndicators = {},
}) => {
  // generateRoomId is your "open 1:1 chat" helper
  const generateRoomId = useGenerateRoomId(currentUser, handleSelectChat);

  // local ui state for "create group"
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // memo so we don't rerender unnecessarily
  const individualMessages = useMemo(
    () => filteredIndividualMessages,
    [filteredIndividualMessages],
  );
  const groupMessages = useMemo(
    () => filteredGroupMessages,
    [filteredGroupMessages],
  );

  // typing indicator for DMs
  const renderTypingIndicator = (userId) => {
    const isTyping = typingIndicators[userId];
    return isTyping ? 'is typing...' : null;
  };

  // --- NEW: create a new group chat via backend ---
  const handleCreateGroup = async () => {
    setCreating(true);
    setCreateError('');

    try {
      // get token from localStorage (we stored it after login)
      const token = localStorage.getItem('access_token');

      // you can customize default room name later with a modal/prompt
      const body = {
        name: 'New Group Chat',
        is_group: true,
      };

      const res = await axios.post('http://localhost:8000/api/rooms', body, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.log('GROUP CREATED ✅:', res.data);

      // res.data.room = روم جدید
      // تو اینجا می‌تونی اتوماتیک اون روم رو باز کنی
      if (res.data?.room?.id) {
        handleSelectChat(res.data.room.id);
      }

      // NOTE:
      // right now we DON'T update groupMessages prop here
      // because groupMessages میاد از بیرون (parent).
      // Parent باید یک رفرش دوباره از /api/rooms بزنه.
      // ما فقط UX رو می‌بریم داخل همون روم جدید.
    } catch (err) {
      console.error('CREATE GROUP ERROR ❌:', err);
      if (err.response && err.response.data) {
        // بک‌اند احتمالا ولیدیشن یا 401/403 برگردونده
        setCreateError(
          typeof err.response.data === 'string'
            ? err.response.data
            : JSON.stringify(err.response.data),
        );
      } else {
        setCreateError('Server error while creating group');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <ListGroup className="message-list-wrapper">
      {/* ----------------- INDIVIDUAL ----------------- */}
      <ListGroup.Item disabled className="list-group-header">
        INDIVIDUAL MESSAGES
      </ListGroup.Item>

      {individualMessages.length > 0 ? (
        individualMessages.map((user) => (
          <ListGroup.Item
            key={user.id}
            action
            active={selectedRoom === user.id}
            onClick={() => generateRoomId(user.id)}
            className="message-list-item"
          >
            <div className="message-row">
              <div className="message-content">
                <img
                  src={user.photo || profilephoto1}
                  alt={user.first_name}
                  className="profile-img"
                />
                {user.is_online && <span className="online-status"></span>}
              </div>

              <div className="message-body">
                <div className="message-header">
                  <span className="user-name">{user.first_name}</span>
                  <span className="time-text">
                    {formatTime(user.last_message?.timestamp)}
                  </span>
                </div>

                <div className="message-details">
                  {renderTypingIndicator(user.id) || (
                    <span className="subtext">
                      {user.last_message?.content}
                    </span>
                  )}

                  {user.unread_count > 0 && (
                    <span className="unread_count">{user.unread_count}</span>
                  )}
                </div>
              </div>
            </div>
          </ListGroup.Item>
        ))
      ) : (
        <ListGroup.Item className="no-messages">
          No individual messages available
        </ListGroup.Item>
      )}

      {/* ----------------- GROUP HEADER + BUTTON ----------------- */}
      <ListGroup.Item className="list-group-header group-header-row">
        <span>GROUP MESSAGES</span>

        <Button
          variant="primary"
          size="sm"
          className="new-group-btn"
          onClick={handleCreateGroup}
          disabled={creating}
        >
          {creating ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
              />{' '}
              Creating...
            </>
          ) : (
            '+ New Group'
          )}
        </Button>
      </ListGroup.Item>

      {createError && (
        <ListGroup.Item className="create-error">
          <span style={{ color: 'red', fontSize: '0.8rem' }}>
            {createError}
          </span>
        </ListGroup.Item>
      )}

      {/* ----------------- GROUP LIST ----------------- */}
      {groupMessages.length > 0 ? (
        groupMessages.map((room) => (
          <ListGroup.Item
            key={room.id}
            action
            active={selectedRoom === room.id}
            onClick={() => handleSelectChat(room.id)}
            className="message-list-item"
          >
            <div className="message-row">
              <div className="message-content">
                <img
                  src={room.photo || profilephoto1}
                  alt={room.name}
                  className="profile-img"
                />
              </div>

              <div className="message-body">
                <div className="message-header">
                  <span className="room-name">{room.name}</span>
                  <span className="time-text">
                    {formatTime(room.last_message?.timestamp)}
                  </span>
                </div>

                <div className="message-details">
                  <span className="subtext">{room.last_message?.content}</span>

                  {room.unread_count > 0 && (
                    <span className="unread_count">{room.unread_count}</span>
                  )}
                </div>
              </div>
            </div>
          </ListGroup.Item>
        ))
      ) : (
        <ListGroup.Item className="no-messages">
          No group messages available
        </ListGroup.Item>
      )}
    </ListGroup>
  );
};

export default MessageList;
