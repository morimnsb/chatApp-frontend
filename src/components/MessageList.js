import React from 'react';
import { ListGroup } from 'react-bootstrap';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import profilephoto1 from '../assets/images/message/profilephoto1.png';

const MessageList = ({
  filteredIndividualMessages,
  filteredGroupMessages,
  handleGenerateRoomId,
  handleSelectChat,
  selectedRoom,
}) => {
  const formatTimestamp = (timestamp) => {
    if (!timestamp) {
      return ''; // Return an empty string or a placeholder if the timestamp is missing
    }

    try {
      const date = parseISO(timestamp);
      if (isToday(date)) {
        return format(date, 'hh:mm a');
      } else if (isYesterday(date)) {
        return `Yesterday at ${format(date, 'hh:mm a')}`;
      } else {
        return format(date, 'MMM d, yyyy, hh:mm a');
      }
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Invalid date'; // Fallback message for invalid dates
    }
  };

  return (
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
              {user.is_online && <span className="online-">online</span>}

            </div>

            <div className="message-body">
              <div className="message-header">
                <span className="user-name">{user.first_name}</span>
                <span className="time-text">{formatTimestamp(user.last_message?.timestamp)}</span>
              </div>
              <div className="message-details">
                <span className="subtext">{user.last_message?.content}</span>
                <span className="unread_count">{user.unread_count}</span>
              </div>
            </div>
          </div>
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
                <span className="time-text">{formatTimestamp(room.last_message?.timestamp)}</span>
              </div>
              <div className="message-details">
                <span className="subtext">{room.last_message?.content}</span>
                <span className="unread_count">{room.unread_count}</span>
              </div>
            </div>
          </div>
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
};

export default MessageList;
