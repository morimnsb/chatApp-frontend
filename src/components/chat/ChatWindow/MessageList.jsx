import React from 'react';
import MessageBubble from '@/MessageBubble';

const MessageList = React.memo(({ messages, currentUserId }) => (
  <div className="messages">
    {Array.isArray(messages) && messages.length
      ? messages.map((m) => <MessageBubble key={m.id} message={m} currentUserId={currentUserId} />)
      : <div className="no-messages">No messages yet</div>}
  </div>
));

export default MessageList;

