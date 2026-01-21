// src/components/MessageList.jsx
import React, { useMemo, useState, useCallback } from 'react';
import { ListGroup, Button, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { formatTime } from '@/utils/formatTime';
import profilephoto1 from '@/assets/images/message/profilephoto1.png';
import './MessageList.css';

const MessageList = ({
  filteredIndividualMessages,
  filteredGroupMessages,
  currentUser,
  handleSelectChat,
  selectedRoom,
  typingIndicators = {},
  onRespondFriendRequest,
}) => {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const individualMessages = useMemo(
    () => (Array.isArray(filteredIndividualMessages) ? filteredIndividualMessages : []),
    [filteredIndividualMessages],
  );

  const groupMessages = useMemo(
    () => (Array.isArray(filteredGroupMessages) ? filteredGroupMessages : []),
    [filteredGroupMessages],
  );

  const renderTypingIndicator = useCallback(
    (userId) => {
      const isTyping = typingIndicators?.[userId];
      return isTyping ? 'is typing...' : null;
    },
    [typingIndicators],
  );

  const handleCreateGroup = async () => {
    setCreating(true);
    setCreateError('');

    try {
      const token = localStorage.getItem('access_token');

      const body = {
        name: 'ias: New Group Chat',
        is_group: true,
      };

      const res = await axios.post('http://localhost:8000/api/rooms', body, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (res.data?.room?.id) {
        handleSelectChat(res.data.room.id);
      }
    } catch (err) {
      if (err?.response?.data) {
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
        individualMessages.map((convo) => {
          const roomId = convo.roomId || convo.room_id || convo.id;
          const userId = convo.partnerId || convo.user_id || convo.id;

          const lastMsg = convo.last_message || convo.lastMessage || null;
          const lastTime =
            convo.last_message_at ||
            convo.lastMessageAt ||
            lastMsg?.timestamp ||
            lastMsg?.created_at ||
            null;

          const displayName =
            convo.first_name ||
            convo.firstName ||
            convo.name ||
            convo.email ||
            `User #${userId}`;

          const avatar = convo.photo || profilephoto1;

          const isActive = selectedRoom === roomId;

          const friendshipStatus = convo.friendship_status;
          const friendshipId = convo.friendship_id;

          const isFriendReqIncoming = friendshipStatus === 'pending_incoming';
          const isFriendReqOutgoing = friendshipStatus === 'pending_outgoing';

          const isSelf =
            currentUser?.id &&
            userId != null &&
            Number(currentUser.id) === Number(userId);

          let subtitle = '';
          if (isFriendReqIncoming) subtitle = 'sent you a friend request';
          else if (isFriendReqOutgoing) subtitle = 'Friend request sent';
          else if (lastMsg) subtitle = lastMsg.content || '';
          else subtitle = '';

          return (
            <ListGroup.Item
              key={`dm-${roomId || userId}`}
              className={`message-list-item p-0 ${isActive ? 'active' : ''}`}
            >
              <div
                role="button"
                tabIndex={0}
                className="message-row w-100"
                style={{ cursor: 'pointer' }}
                onClick={() => handleSelectChat(roomId, userId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSelectChat(roomId, userId);
                }}
              >
                <div className="message-content">
  <img
    src={avatar}
    alt={displayName}
    className={`profile-img ${convo.is_online ? 'is-online' : 'is-offline'}`}
  />
</div>


                <div className="message-body">
                  <div className="message-header">
                    <span className="user-name">
                      {displayName}{' '}
                      {isSelf && (
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          (you)
                        </span>
                      )}
                    </span>
                    <span className="time-text">{lastTime ? formatTime(lastTime) : ''}</span>
                  </div>

                  <div className="message-details">
                    {isFriendReqIncoming && friendshipId ? (
                      <div className="d-flex align-items-center gap-2 w-100">
                        <span className="subtext">{subtitle}</span>

                        {onRespondFriendRequest && (
                          <div className="d-flex gap-1 ms-auto">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRespondFriendRequest({ friendshipId, action: 'accept' });
                              }}
                            >
                              Accept
                            </Button>

                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRespondFriendRequest({ friendshipId, action: 'reject' });
                              }}
                            >
                              Decline
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {renderTypingIndicator(userId) || <span className="subtext">{subtitle}</span>}

                        {convo.unread_count > 0 && (
                          <span className="unread_count">{convo.unread_count}</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </ListGroup.Item>
          );
        })
      ) : (
        <ListGroup.Item className="no-messages">No individual messages available</ListGroup.Item>
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
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />{' '}
              Creating...
            </>
          ) : (
            '+ New Group'
          )}
        </Button>
      </ListGroup.Item>

      {createError && (
        <ListGroup.Item className="create-error">
          <span style={{ color: 'red', fontSize: '0.8rem' }}>{createError}</span>
        </ListGroup.Item>
      )}

      {/* ----------------- GROUP LIST ----------------- */}
      {groupMessages.length > 0 ? (
        groupMessages.map((room) => (
          <ListGroup.Item
            key={`group-${room.id}`}
            className={`message-list-item p-0 ${selectedRoom === room.id ? 'active' : ''}`}
          >
            <div
              role="button"
              tabIndex={0}
              className="message-row w-100"
              style={{ cursor: 'pointer' }}
              onClick={() => handleSelectChat(room.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSelectChat(room.id);
              }}
            >
              <div className="message-content">
                <img src={room.photo || profilephoto1} alt={room.name} className="profile-img" />
              </div>

              <div className="message-body">
                <div className="message-header">
                  <span className="room-name">{room.name}</span>
                  <span className="time-text">
                    {room.last_message
                      ? formatTime(room.last_message.timestamp || room.last_message.created_at)
                      : ''}
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
        <ListGroup.Item className="no-messages">No group messages available</ListGroup.Item>
      )}
    </ListGroup>
  );
};

export default MessageList;
