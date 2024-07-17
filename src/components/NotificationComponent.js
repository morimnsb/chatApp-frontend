import React from 'react';

const NotificationComponent = ({ chatrooms }) => {
  return (
    <div className="notification-container">
      {Object.keys(chatrooms).map((roomId) => {
        const chatroom = chatrooms[roomId];
        return (
          <div key={roomId} className="notification">
            {chatroom.unreadCount > 0 && (
              <p>
                {`Chatroom ${roomId} has ${chatroom.unreadCount} unread message(s)`}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default NotificationComponent;
