// src/components/ConversationList.jsx
import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { ListGroup, Button, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { formatTime } from '@/utils/formatTime';
import profilephoto1 from '@/assets/images/message/profilephoto1.png';
import './ConversationList.css';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';
const log = (...a) => DEBUG && console.log('[ConversationList]', ...a);

const safeArr = (v) => (Array.isArray(v) ? v : []);
const clip = (s, n = 38) => {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const getLastText = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v?.content || v?.message || '';
};

export default function ConversationList({
  filteredIndividualMessages,
  filteredGroupMessages,
  currentUser,
  handleSelectChat,
  selectedRoom,
  typingIndicators = {},
  onRespondFriendRequest,
}) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const individualMessages = useMemo(
    () => safeArr(filteredIndividualMessages),
    [filteredIndividualMessages],
  );

  const groupMessages = useMemo(
    () => safeArr(filteredGroupMessages),
    [filteredGroupMessages],
  );

  const renderTypingIndicator = useCallback(
    (userId) => {
      const isTyping = typingIndicators?.[userId];
      return isTyping ? 'is typing...' : null;
    },
    [typingIndicators],
  );

  // debug snapshot (only on change)
  const prevSig = useRef('');
  useEffect(() => {
    if (!DEBUG) return;

    const sigObj = {
      selectedRoom,
      dmCount: individualMessages.length,
      groupCount: groupMessages.length,
      dmSample: individualMessages.slice(0, 2).map((c) => ({
        roomId: c?.roomId,
        partnerId: c?.partnerId,
        name: c?.first_name,
        lastText: getLastText(c?.last_message_obj ?? c?.last_message) || c?.last_message_text || '',

        lastAt: c?.last_message_at || null,
      })),
      groupSample: groupMessages.slice(0, 2).map((r) => ({
        id: r?.id,
        name: r?.name,
        lastText: r?.last_message?.content || r?.last_message_text || '',
        lastAt: r?.last_message_at || null,
      })),
    };

    const sig = JSON.stringify(sigObj);
    if (sig !== prevSig.current) {
      prevSig.current = sig;
      log('snapshot', sigObj);
    }
  }, [DEBUG, selectedRoom, individualMessages, groupMessages]);

  const handleCreateGroup = useCallback(async () => {
    setCreating(true);
    setCreateError('');

    try {
      const token = localStorage.getItem('access_token');
      const body = { name: 'ias: New Group Chat', is_group: true };

      const res = await axios.post('http://localhost:8000/api/rooms', body, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      log('create group response', res?.data);

      if (res.data?.room?.id) {
        handleSelectChat(res.data.room.id);
      }
    } catch (e) {
      log('create group error', e);
      if (e?.response?.data) {
        setCreateError(
          typeof e.response.data === 'string'
            ? e.response.data
            : JSON.stringify(e.response.data),
        );
      } else {
        setCreateError('Server error while creating group');
      }
    } finally {
      setCreating(false);
    }
  }, [handleSelectChat]);

  return (
    <ListGroup className="message-list-wrapper">
      {/* ----------------- INDIVIDUAL ----------------- */}
      <ListGroup.Item disabled className="list-group-header">
        INDIVIDUAL MESSAGES
      </ListGroup.Item>

      {individualMessages.length > 0 ? (
        individualMessages.map((convo) => {
          const roomId = convo?.roomId ?? convo?.room_id ?? convo?.chat_room_id ?? convo?.id ?? null;
          const userId = convo?.partnerId ?? convo?.partner_id ?? convo?.user_id ?? convo?.id ?? null;

          const lastMsgObj = convo?.last_message_obj ?? convo?.last_message ?? null;
const lastMsgText = getLastText(lastMsgObj) || convo?.last_message_text || '';


          const lastTime =
  convo?.last_message_at ||
  (typeof lastMsgObj === 'object' ? (lastMsgObj?.created_at || lastMsgObj?.timestamp) : null) ||
  null;


          const displayName =
            convo?.first_name || convo?.firstName || convo?.name || convo?.email || `User #${userId}`;

          const avatar = convo?.photo || convo?.avatar || profilephoto1;
          const isActive = Number(selectedRoom) === Number(roomId);

          const friendshipStatus = convo?.friendship_status;
          const friendshipId = convo?.friendship_id;

          const isFriendReqIncoming = friendshipStatus === 'pending_incoming';
          const isFriendReqOutgoing = friendshipStatus === 'pending_outgoing';

          const isSelf =
            currentUser?.id && userId != null && Number(currentUser.id) === Number(userId);

          // subtitle (line 2)
          let subtitle = '';
          if (isFriendReqIncoming) subtitle = 'sent you a friend request';
          else if (isFriendReqOutgoing) subtitle = 'Friend request sent';
          else subtitle = clip(lastMsgText, 60);

          // ✅ inline last message next to name
          const inlinePreview =
            !isFriendReqIncoming && !isFriendReqOutgoing
              ? clip(lastMsgText, 28)
              : '';

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
                    className={`profile-img ${convo?.is_online ? 'is-online' : 'is-offline'}`}
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

                      {/* ✅ inline last message */}
                      {inlinePreview ? (
                        <span className="text-muted" style={{ fontSize: 12, marginLeft: 8 }}>
                          · {inlinePreview}
                        </span>
                      ) : null}
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
                        {renderTypingIndicator(userId) ? (
                          <span className="subtext">{renderTypingIndicator(userId)}</span>
                        ) : (
                          <span className="subtext">{subtitle}</span>
                        )}

                        {Number(convo?.unread_count || 0) > 0 && (
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
        groupMessages.map((room) => {
          const roomId = room?.id ?? null;

          const lastMsgObj = room?.last_message_obj ?? room?.last_message ?? null;
const lastMsgText = getLastText(lastMsgObj) || room?.last_message_text || '';


          const lastTime =
            room?.last_message_at ||
            lastMsgObj?.created_at ||
            lastMsgObj?.timestamp ||
            null;

          const name = room?.name || room?.title || room?.room_name || `Room #${roomId}`;
          const isActive = Number(selectedRoom) === Number(roomId);

          const inlinePreview = clip(lastMsgText, 28);

          return (
            <ListGroup.Item
              key={`group-${roomId}`}
              className={`message-list-item p-0 ${isActive ? 'active' : ''}`}
            >
              <div
                role="button"
                tabIndex={0}
                className="message-row w-100"
                style={{ cursor: 'pointer' }}
                onClick={() => handleSelectChat(roomId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSelectChat(roomId);
                }}
              >
                <div className="message-content">
                  <img src={room?.photo || profilephoto1} alt={name} className="profile-img" />
                </div>

                <div className="message-body">
                  <div className="message-header">
                    <span className="room-name">
                      {name}
                      {inlinePreview ? (
                        <span className="text-muted" style={{ fontSize: 12, marginLeft: 8 }}>
                          · {inlinePreview}
                        </span>
                      ) : null}
                    </span>

                    <span className="time-text">{lastTime ? formatTime(lastTime) : ''}</span>
                  </div>

                  <div className="message-details">
                    <span className="subtext">{clip(lastMsgText, 60)}</span>

                    {Number(room?.unread_count || 0) > 0 && (
                      <span className="unread_count">{room.unread_count}</span>
                    )}
                  </div>
                </div>
              </div>
            </ListGroup.Item>
          );
        })
      ) : (
        <ListGroup.Item className="no-messages">No group messages available</ListGroup.Item>
      )}
    </ListGroup>
  );
}
