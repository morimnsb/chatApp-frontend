// src/shared/components/ConversationList.jsx
import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { ListGroup, Button, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';

import { formatTime } from '@/shared/utils/formatTime';
import profilephoto1 from '@/assets/images/message/profilephoto1.png';
import './ConversationList.css';

import { setIndividualMessages, setGroupMessages } from '@/features/chat/state/messageActions';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';
const log = (...a) => DEBUG && console.log('[ConversationList]', ...a);

const API = (import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:8000');
const FETCH_URL = `${API}/api/chatMeetUp/conversations/`;

const safeArr = (v) => (Array.isArray(v) ? v : []);
const clip = (s, n = 38) => {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const getLastText = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v?.content || v?.message || v?.text || '';
};

const getRoomId = (c) => c?.roomId ?? c?.room_id ?? c?.chat_room_id ?? c?.id ?? null;

const inferIsGroup = (x) =>
  Boolean(
    x?.is_group ??
      x?.isGroup ??
      x?.room?.is_group ??
      x?.room?.isGroup ??
      (x?.name && x?.partnerId == null)
  );

export default function ConversationList({
  filteredIndividualMessages,
  filteredGroupMessages,

  currentUser,
  handleSelectChat,
  selectedRoom,
  typingIndicators = {},
  onRespondFriendRequest,

  // ✅ from presence-global
  onlineUsers = [],
}) {
  const dispatch = useDispatch();

  const { storeDM, storeGRP } = useSelector(
    (state) => ({
      storeDM: state.messages?.individualMessages || [],
      storeGRP: state.messages?.groupMessages || [],
    }),
    shallowEqual
  );

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState('');

  // ✅ Presence -> Set for fast lookup
  const onlineSet = useMemo(() => {
    const s = new Set();
    safeArr(onlineUsers).forEach((u) => {
      if (u?.id != null) s.add(String(u.id));
    });
    return s;
  }, [onlineUsers]);

  const individualMessages = useMemo(() => {
    const fromProps = safeArr(filteredIndividualMessages);
    return fromProps.length ? fromProps : safeArr(storeDM);
  }, [filteredIndividualMessages, storeDM]);

  const groupMessages = useMemo(() => {
    const fromProps = safeArr(filteredGroupMessages);
    return fromProps.length ? fromProps : safeArr(storeGRP);
  }, [filteredGroupMessages, storeGRP]);

  const renderTypingIndicator = useCallback(
    (userId) => (typingIndicators?.[userId] ? 'is typing...' : null),
    [typingIndicators]
  );

  // =========================
  // ✅ SAFE FETCH (no spam)
  // =========================
  const didFetchRef = useRef(false);
  const inFlightRef = useRef(false);
  const abortRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    if (inFlightRef.current) {
      log('FETCH skip (inFlight)');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      setFetchErr('Missing access token (not logged in)');
      return;
    }

    // cancel previous if any
    try {
      abortRef.current?.abort?.();
    } catch {}

    const controller = new AbortController();
    abortRef.current = controller;

    inFlightRef.current = true;
    setFetching(true);
    setFetchErr('');

    try {
      log('FETCH start', { url: FETCH_URL });

      const res = await axios.get(FETCH_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      const data = res?.data;
      const list =
        safeArr(data?.results) ||
        safeArr(data?.data) ||
        safeArr(data?.conversations) ||
        safeArr(data) ||
        [];

      const dm = [];
      const grp = [];

      for (const item of list) {
        if (inferIsGroup(item)) grp.push(item);
        else dm.push(item);
      }

      dispatch(setIndividualMessages(dm));
      dispatch(setGroupMessages(grp));

      didFetchRef.current = true;

      log('FETCH ok', { total: list.length, dm: dm.length, grp: grp.length });
    } catch (e) {
      const isCanceled =
        e?.name === 'CanceledError' ||
        e?.code === 'ERR_CANCELED' ||
        e?.name === 'AbortError';

      const msg = isCanceled
        ? 'Fetch canceled'
        : e?.response?.data
        ? typeof e.response.data === 'string'
          ? e.response.data
          : JSON.stringify(e.response.data)
        : e?.message || 'Fetch failed';

      if (!isCanceled) setFetchErr(msg);
      log('FETCH error', msg, e);
    } finally {
      inFlightRef.current = false;
      setFetching(false);
    }
  }, [dispatch]);

  useEffect(() => {
    const propsHasData =
      safeArr(filteredIndividualMessages).length > 0 || safeArr(filteredGroupMessages).length > 0;

    const storeHasData = safeArr(storeDM).length > 0 || safeArr(storeGRP).length > 0;

    // اگر parent داده می‌دهد → هیچ fetch
    if (propsHasData) return;

    // اگر store پر است → هیچ fetch
    if (storeHasData) return;

    // فقط یک بار در عمر این mount
    if (didFetchRef.current) return;

    didFetchRef.current = true;
    fetchConversations();

    return () => {
      try {
        abortRef.current?.abort?.();
      } catch {}
    };
  }, [fetchConversations, filteredIndividualMessages, filteredGroupMessages, storeDM, storeGRP]);

  const handleCreateGroup = useCallback(async () => {
    setCreating(true);
    setCreateError('');

    try {
      const token = localStorage.getItem('access_token');
      const body = { name: 'ias: New Group Chat', is_group: true };

      const res = await axios.post(`${API}/api/rooms`, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      log('create group response', res?.data);

      if (res.data?.room?.id) {
        handleSelectChat(res.data.room.id);
        // ✅ manual refresh once
        didFetchRef.current = false;
        fetchConversations();
      }
    } catch (e) {
      log('create group error', e);
      if (e?.response?.data) {
        setCreateError(
          typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data)
        );
      } else {
        setCreateError('Server error while creating group');
      }
    } finally {
      setCreating(false);
    }
  }, [handleSelectChat, fetchConversations]);

  return (
    <ListGroup className="message-list-wrapper">
      {(fetching || fetchErr) && (
        <ListGroup.Item
          className="list-group-header"
          style={{ display: 'flex', gap: 10, alignItems: 'center' }}
        >
          {fetching ? (
            <>
              <Spinner as="span" animation="border" size="sm" /> <span>Loading conversations…</span>
            </>
          ) : (
            <>
              <span style={{ color: 'crimson' }}>Fetch error:</span>
              <span style={{ fontSize: 12 }}>{fetchErr}</span>
              <Button
                size="sm"
                variant="outline-primary"
                onClick={() => {
                  didFetchRef.current = false;
                  fetchConversations();
                }}
                style={{ marginLeft: 'auto' }}
              >
                Retry
              </Button>
            </>
          )}
        </ListGroup.Item>
      )}

      <ListGroup.Item disabled className="list-group-header">
        INDIVIDUAL MESSAGES
      </ListGroup.Item>

      {individualMessages.length > 0 ? (
        individualMessages.map((convo) => {
          const roomId = getRoomId(convo);
          const userId = convo?.partnerId ?? convo?.partner_id ?? convo?.user_id ?? null;

          const lastMsgObj = convo?.last_message_obj ?? convo?.last_message ?? null;
          const lastMsgText = getLastText(lastMsgObj) || convo?.last_message_text || '';

          const lastTime =
            convo?.last_message_at ||
            (typeof lastMsgObj === 'object' ? lastMsgObj?.created_at || lastMsgObj?.timestamp : null) ||
            null;

          const displayName =
            convo?.first_name ||
            convo?.firstName ||
            convo?.name ||
            convo?.email ||
            `User #${userId ?? '?'}`;

          const avatar = convo?.photo || convo?.avatar || profilephoto1;
          const isActive = Number(selectedRoom) === Number(roomId);

          const friendshipStatus = convo?.friendship_status;
          const friendshipId = convo?.friendship_id;

          const isFriendReqIncoming = friendshipStatus === 'pending_incoming';
          const isFriendReqOutgoing = friendshipStatus === 'pending_outgoing';

          const isSelf = currentUser?.id && userId != null && Number(currentUser.id) === Number(userId);

          let subtitle = '';
          if (isFriendReqIncoming) subtitle = 'sent you a friend request';
          else if (isFriendReqOutgoing) subtitle = 'Friend request sent';
          else subtitle = clip(lastMsgText, 60);

          const inlinePreview =
            !isFriendReqIncoming && !isFriendReqOutgoing ? clip(lastMsgText, 28) : '';

          const isOnline = userId != null ? onlineSet.has(String(userId)) : false;

          return (
            <ListGroup.Item
              key={`dm-${roomId || userId || Math.random()}`}
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
                  <div className={`avatar-ring ${isOnline ? 'ring-online' : 'ring-offline'}`}>
                    <img src={avatar} alt={displayName} className="profile-img" />
                  </div>
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

      {groupMessages.length > 0 ? (
        groupMessages.map((room) => {
          const roomId = room?.id ?? null;

          const lastMsgObj = room?.last_message_obj ?? room?.last_message ?? null;
          const lastMsgText = getLastText(lastMsgObj) || room?.last_message_text || '';

          const lastTime = room?.last_message_at || lastMsgObj?.created_at || lastMsgObj?.timestamp || null;

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
                  <div className="avatar-ring ring-group">
                    <img src={room?.photo || profilephoto1} alt={name} className="profile-img" />
                  </div>
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
