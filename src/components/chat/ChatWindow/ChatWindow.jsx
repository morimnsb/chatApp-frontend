// src/components/ConversationList.jsx
import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { ListGroup, Button, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';

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

const coerceNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ✅ selectors (این‌ها را اگر نام state شما فرق دارد، فقط اینجا تغییر بده)
const selectByRoom = (state) =>
  state?.messages?.byRoom || state?.message?.byRoom || state?.messageSlice?.byRoom || {};

const selectDmRooms = (state) =>
  state?.messages?.rooms?.individual ||
  state?.messages?.dmRooms ||
  state?.message?.rooms?.individual ||
  [];

const selectGroupRooms = (state) =>
  state?.messages?.rooms?.groups ||
  state?.messages?.groupRooms ||
  state?.message?.rooms?.groups ||
  [];

export default function ConversationList({
  currentUser,
  handleSelectChat,
  selectedRoom,
  typingIndicators = {},
  onRespondFriendRequest,
}) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const byRoom = useSelector(selectByRoom);
  const dmRoomsRaw = useSelector(selectDmRooms);
  const groupRoomsRaw = useSelector(selectGroupRooms);

  const individualMessages = useMemo(() => safeArr(dmRoomsRaw), [dmRoomsRaw]);
  const groupMessages = useMemo(() => safeArr(groupRoomsRaw), [groupRoomsRaw]);

  const renderTypingIndicator = useCallback(
    (userId) => (typingIndicators?.[userId] ? 'is typing...' : null),
    [typingIndicators]
  );

  // ✅ helper: get last message from byRoom for a room
  const getLastForRoom = useCallback(
    (roomId) => {
      const rid = String(roomId);
      const arr = safeArr(byRoom?.[rid]);
      return arr.length ? arr[arr.length - 1] : null;
    },
    [byRoom]
  );

  // debug snapshot
  const prevSig = useRef('');
  useEffect(() => {
    if (!DEBUG) return;

    const sampleDm = individualMessages.slice(0, 2).map((c) => {
      const roomId = c?.roomId ?? c?.room_id ?? c?.chat_room_id ?? c?.id ?? null;
      const last = roomId ? getLastForRoom(roomId) : null;
      return {
        roomId,
        name: c?.first_name || c?.name,
        lastText: last?.content || c?.last_message_text || '',
        lastAt: last?.created_at || c?.last_message_at || null,
      };
    });

    const sigObj = {
      selectedRoom,
      dmCount: individualMessages.length,
      groupCount: groupMessages.length,
      dmSample: sampleDm,
    };

    const sig = JSON.stringify(sigObj);
    if (sig !== prevSig.current) {
      prevSig.current = sig;
      log('snapshot', sigObj);
    }
  }, [DEBUG, selectedRoom, individualMessages, groupMessages, getLastForRoom]);

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
            : JSON.stringify(e.response.data)
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
          const roomId =
            convo?.roomId ?? convo?.room_id ?? convo?.chat_room_id ?? convo?.id ?? null;

          const userId =
            convo?.partnerId ?? convo?.partner_id ?? convo?.user_id ?? null;

          const last = roomId ? getLastForRoom(roomId) : null;

          const lastMsgText =
            last?.content ||
            convo?.last_message_text ||
            convo?.last_message?.content ||
            '';

          const lastTime =
            last?.created_at ||
            convo?.last_message_at ||
            convo?.last_message?.created_at ||
            null;

          const displayName =
            convo?.first_name ||
            convo?.firstName ||
            convo?.name ||
            convo?.email ||
            `User #${userId ?? ''}`;

          const avatar = convo?.photo || convo?.avatar || profilephoto1;
          const isActive = Number(selectedRoom) === Number(roomId);

          const friendshipStatus = convo?.friendship_status;
          const friendshipId = convo?.friendship_id;

          const isFriendReqIncoming = friendshipStatus === 'pending_incoming';
          const isFriendReqOutgoing = friendshipStatus === 'pending_outgoing';

          const isSelf =
            currentUser?.id && userId != null && Number(currentUser.id) === Number(userId);

          let subtitle = '';
          if (isFriendReqIncoming) subtitle = 'sent you a friend request';
          else if (isFriendReqOutgoing) subtitle = 'Friend request sent';
          else subtitle = clip(lastMsgText, 60);

          const inlinePreview =
            !isFriendReqIncoming && !isFriendReqOutgoing ? clip(lastMsgText, 28) : '';

          return (
            <ListGroup.Item
              key={`dm-${String(roomId ?? userId ?? displayName)}`} // ✅ stable
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
          const last = roomId ? getLastForRoom(roomId) : null;

          const lastMsgText =
            last?.content || room?.last_message_text || room?.last_message?.content || '';

          const lastTime =
            last?.created_at || room?.last_message_at || room?.last_message?.created_at || null;

          const name = room?.name || room?.title || room?.room_name || `Room #${roomId}`;
          const isActive = Number(selectedRoom) === Number(roomId);

          const inlinePreview = clip(lastMsgText, 28);

          return (
            <ListGroup.Item
              key={`group-${String(roomId ?? name)}`}
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
