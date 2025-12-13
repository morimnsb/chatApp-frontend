import React from 'react';
import { formatTime } from '@/../../utils/formatTime';
import profilephoto1 from '@/../../assets/images/message/profilephoto1.png';

const MessageBubble = React.memo(({ message, currentUserId }) => (
  <div className="message-bubble">
    {message.sender_first_name && (
      <div className="chat-header-details">
        <img
          src={message.photo || profilephoto1}
          alt={message.sender_first_name}
          className="chat-header-img"
        />
        <div className="chat-header-info"><h4>{message.sender_first_name}</h4></div>
      </div>
    )}
    <div className="message-text">
      {message.content}
      <span className="message-time">
        {formatTime(message.timestamp || message.created_at)}
      </span>
      {message.sender_id === currentUserId && (
        <span className={`read_receipt ${message.read_receipt ? 'read' : ''}`}>✓✓</span>
      )}
    </div>
  </div>
));

export default MessageBubble;

