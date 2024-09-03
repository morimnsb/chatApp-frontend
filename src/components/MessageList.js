import React, { useMemo } from 'react';
import { ListGroup } from 'react-bootstrap';
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
  typingIndicators = {}, // Default value for typingIndicators to avoid undefined errors
}) => {
  // Generate room ID for individual chats
  const generateRoomId = useGenerateRoomId(currentUser, handleSelectChat);

  // Memoize individual and group messages to prevent unnecessary re-renders
  const individualMessages = useMemo(
    () => filteredIndividualMessages,
    [filteredIndividualMessages],
  );
  const groupMessages = useMemo(
    () => filteredGroupMessages,
    [filteredGroupMessages],
  );

  // Function to render typing indicator if the user is typing
  const renderTypingIndicator = (userId) => {
    const isTyping = typingIndicators[userId];
    return isTyping ? 'is typing...' : null;
  };

  return (
    <ListGroup>
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

      <ListGroup.Item disabled className="list-group-header">
        GROUP MESSAGES
      </ListGroup.Item>
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
