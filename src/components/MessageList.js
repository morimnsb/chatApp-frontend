import React, { useMemo, useEffect } from 'react';
import { ListGroup } from 'react-bootstrap';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import useGenerateRoomId from './useGenerateRoomId'; // Make sure the path is correct
import profilephoto1 from '../assets/images/message/profilephoto1.png';
import './MessageList.css';

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';

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
    return 'Invalid date';
  }
};

const MessageList = ({
  filteredIndividualMessages,
  filteredGroupMessages,
  currentUser, // Add currentUser prop
  handleSelectChat,
  selectedRoom,
}) => {
  // Use the useGenerateRoomId hook
  const generateRoomId = useGenerateRoomId(currentUser, handleSelectChat);

  const individualMessages = useMemo(
    () => filteredIndividualMessages,
    [filteredIndividualMessages],
  );
  const groupMessages = useMemo(
    () => filteredGroupMessages,
    [filteredGroupMessages],
  );

  useEffect(() => {
    console.log(
      'Rendering MessageList with individualMessages:',
      individualMessages,
    );
    console.log('Rendering MessageList with groupMessages:', groupMessages);
  }, [individualMessages, groupMessages]);

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
            onClick={() => generateRoomId(user.id)} // Use generateRoomId for individual messages
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
                    {formatTimestamp(user.last_message?.timestamp)}
                  </span>
                </div>
                <div className="message-details">
                  <span className="subtext">{user.last_message?.content}</span>
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
            onClick={() => handleSelectChat(room.id)} // Use handleSelectChat for group messages
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
                    {formatTimestamp(room.last_message?.timestamp)}
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
