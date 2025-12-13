// src/components/MessageList.jsx
import React, { useMemo, useState } from 'react';
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
  onRespondFriendRequest, // 👈 برای accept/reject
}) => {
  // local ui state برای ساخت گروه (اگر فعلاً می‌خوای نگه داریش)
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const individualMessages = useMemo(
    () => filteredIndividualMessages || [],
    [filteredIndividualMessages],
  );

  const groupMessages = useMemo(
    () => filteredGroupMessages || [],
    [filteredGroupMessages],
  );

  const renderTypingIndicator = (userId) => {
    const isTyping = typingIndicators[userId];
    return isTyping ? 'is typing...' : null;
  };

  // --- ایجاد گروه جدید (همون قبلی) ---
  const handleCreateGroup = async () => {
    setCreating(true);
    setCreateError('');

    try {
      const token = localStorage.getItem('access_token');

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

      if (res.data?.room?.id) {
        handleSelectChat(res.data.room.id);
      }
    } catch (err) {
      console.error('CREATE GROUP ERROR ❌:', err);
      if (err.response && err.response.data) {
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
          // 👇 این‌ها را از normalizeDmList و بک‌اند می‌گیری
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

          // 👇 وضعیت دوستی از بک‌اند (همونی که تو لاگ دیدی)
          const friendshipStatus = convo.friendship_status;
          const friendshipId = convo.friendship_id;
          const isFriendReqIncoming = friendshipStatus === 'pending_incoming';
          const isFriendReqOutgoing = friendshipStatus === 'pending_outgoing';

          const isSelf =
            currentUser?.id &&
            userId != null &&
            Number(currentUser.id) === Number(userId);

          // --- متن زیر نام: ---
          let subtitle;
          if (isFriendReqIncoming) {
            subtitle = 'sent you a friend request';
          } else if (isFriendReqOutgoing) {
            subtitle = 'Friend request sent';
          } else if (lastMsg) {
            subtitle = lastMsg.content;
          } else {
            subtitle = '';
          }

          return (
            <ListGroup.Item
              key={`dm-${roomId || userId}`} // 👈 برای حذف هشدار key
              action
              active={isActive}
              onClick={() => handleSelectChat(roomId, userId)}
              className="message-list-item"
            >
              <div className="message-row">
                <div className="message-content">
                  <img
                    src={avatar}
                    alt={displayName}
                    className="profile-img"
                  />
                  {convo.is_online && <span className="online-status"></span>}
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
                    <span className="time-text">
                      {lastTime ? formatTime(lastTime) : ''}
                    </span>
                  </div>

                  <div className="message-details">
                    {/* اگر درخواست دوستی incoming هست → دکمه‌ها */}
                    {isFriendReqIncoming && friendshipId ? (
                      <div className="d-flex align-items-center gap-2">
                        <span className="subtext">{subtitle}</span>
                        {onRespondFriendRequest && (
                          <div className="d-flex gap-1 ms-auto">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRespondFriendRequest({
                                  friendshipId,
                                  action: 'accept',
                                });
                              }}
                            >
                              Accept
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRespondFriendRequest({
                                  friendshipId,
                                  action: 'reject',
                                });
                              }}
                            >
                              Decline
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* حالت‌های دیگر: یا تایپینگ، یا متن آخرین پیام */}
                        {renderTypingIndicator(userId) || (
                          <span className="subtext">{subtitle}</span>
                        )}

                        {/* unread count مثل قبل */}
                        {convo.unread_count > 0 && (
                          <span className="unread_count">
                            {convo.unread_count}
                          </span>
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
            key={`group-${room.id}`} // 👈 prefix برای جلوگیری از key تکراری
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
                    {room.last_message
                      ? formatTime(
                          room.last_message.timestamp ||
                            room.last_message.created_at,
                        )
                      : ''}
                  </span>
                </div>

                <div className="message-details">
                  <span className="subtext">
                    {room.last_message?.content}
                  </span>

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
