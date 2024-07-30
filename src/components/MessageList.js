import React from 'react';
import { ListGroup } from 'react-bootstrap';

const MessageList = ({
  filteredIndividualMessages,
  filteredGroupMessages,
  handleGenerateRoomId,
  handleSelectChat,
  selectedRoom,
}) => (
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
        <img src={user.photo} alt={user.first_name} className="profile-img" />
        {user.first_name}{' '}
        <span className="subtext">{user.last_message?.content}</span>
        <span className="time-text">{user.last_message?.timestamp}</span>
        {user.is_online && <span className="online-status">Online</span>}
        <span className="unread_count">{user.unread_count}</span>
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
        <img src={room.photo} alt={room.name} className="profile-img" />
        {room.name}{' '}
        <span className="subtext">{room.last_message?.content}</span>
        <span className="time-text">{room.last_message?.timestamp}</span>
        <span className="unread_count">{room.unread_count}</span>
      </ListGroup.Item>
    ))}
  </ListGroup>
);

export default MessageList;
