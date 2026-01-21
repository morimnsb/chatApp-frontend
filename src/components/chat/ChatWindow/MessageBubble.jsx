import React from 'react';
import { formatTime } from '@/../../utils/formatTime';
import profilephoto1 from '@/../../assets/images/message/profilephoto1.png';

const MessageBubble = React.memo(({ message, currentUserId }) => (
  <div className={`message-bubble ${message.sender_id === currentUserId ? 'mine' : 'theirs'}`}>



    {message.sender_first_name && (
      <div className="chat-header-details">
        <div className={`avatar-wrap ${message.isOnline ? 'is-online' : ''}`}>
  <img
    src={message.photo || profilephoto1}
    alt={message.sender_first_name}
    className="chat-header-img"
  />
  {message.isOnline && <span className="online-dot" />}
</div>

        <div className="chat-header-info"><h4>{message.sender_first_name}</h4></div>
      </div>
    )}
    <div
  className="message-text"
  data-optimistic={message._optimistic ? 'true' : 'false'}
  data-failed={message._failed ? 'true' : 'false'}
>


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

