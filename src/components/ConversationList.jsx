// src/components/ConversationList.jsx
import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { ListGroup, Button, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';

import { formatTime } from '@/utils/formatTime';
import profilephoto1 from '@/assets/images/message/profilephoto1.png';
import './ConversationList.css';

// ✅ NEW slice actions
import { setIndividualMessages, setGroupMessages } from '@/redux/slices/messageSlice';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';
const log = (...a) => DEBUG && console.log('[ConversationList]', ...a);

const API = (import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:8000');

// ✅ IMPORTANT: change this if your endpoint differs
const FETCH_URL = `${API}/api/chatMeetUp/conversations/`;

const safeArr = (v) => (Array.isArray(v) ? v : []);
const toStr = (v) => (v == null ? '' : String(v));
const eqId = (a, b) => a != null && b != null && toStr(a) === toStr(b);

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
      (x?.name && x?.partnerId == null) // fallback weak signal
  );

export default function ConversationList({
  // ✅ optional props (اگر parent فیلتر می‌کنه)
  filteredIndividualMessages,
  filteredGroupMessages,

  currentUser,
  handleSelectChat,
  selectedRoom,
  typingIndicators = {},
  onRespondFriendRequest,
}) {
  const dispatch = useDispatch();

  // ✅ read from Redux as the single source of truth
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

  // ✅ pick data: props (if provided) else store
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

  // ✅ FETCH conversations on mount + when user/token changes
  const didFetchRef = useRef(false);
  const fetchConversations = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setFetchErr('Missing access token (not logged in)');
      return;
    }

    setFetching(true);
    setFetchErr('');

    const controller = new AbortController();

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
      // پترن‌های مختلف پاسخ
      const list =
        safeArr(data?.results) ||
        safeArr(data?.data) ||
        safeArr(data?.conversations) ||
        safeArr(data) ||
        [];

      // ✅ split to dm/group
      const dm = [];
      const grp = [];

      for (const item of list) {
        if (inferIsGroup(item)) grp.push(item);
        else dm.push(item);
      }

      // ✅ store
      dispatch(setIndividualMessages(dm));
      dispatch(setGroupMessages(grp));

      didFetchRef.current = true;

      log('FETCH ok', { total: list.length, dm: dm.length, grp: grp.length });
    } catch (e) {
      const msg =
        e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED'
          ? 'Fetch canceled'
          : e?.response?.data
          ? typeof e.response.data === 'string'
            ? e.response.data
            : JSON.stringify(e.response.data)
          : e?.message || 'Fetch failed';
      setFetchErr(msg);
      log('FETCH error', msg, e);
    } finally {
      setFetching(false);
    }

    return () => controller.abort();
  }, [dispatch]);

  useEffect(() => {
    // ✅ اگر از props دیتای کامل میاد، مجبور نیستیم fetch کنیم
    const propsHasData =
      safeArr(filteredIndividualMessages).length > 0 || safeArr(filteredGroupMessages).length > 0;

    // ✅ اگر store خالیه یا هنوز fetch نکردیم → fetch
    const storeEmpty = safeArr(storeDM).length === 0 && safeArr(storeGRP).length === 0;

    if (propsHasData) return;
    if (!didFetchRef.current || storeEmpty) {
      fetchConversations();
    }
  }, [
    fetchConversations,
    filteredIndividualMessages,
    filteredGroupMessages,
    storeDM,
    storeGRP,
  ]);

  // debug snapshot
  const prevSig = useRef('');
  useEffect(() => {
    if (!DEBUG) return;
    const sigObj = {
      selectedRoom,
      dmCount: individualMessages.length,
      groupCount: groupMessages.length,
      topDM: individualMessages[0]
        ? {
            roomId: getRoomId(individualMessages[0]),
            name:
              individualMessages[0]?.first_name ||
              individualMessages[0]?.name ||
              individualMessages[0]?.email ||
              null,
            lastAt: individualMessages[0]?.last_message_at || null,
          }
        : null,
      topGroup: groupMessages[0]
        ? { id: groupMessages[0]?.id ?? null, name: groupMessages[0]?.name ?? null }
        : null,
    };
    const sig = JSON.stringify(sigObj);
    if (sig !== prevSig.current) {
      prevSig.current = sig;
      console.log('[ConversationList][TRACE]', sigObj);
    }
  }, [DEBUG, selectedRoom, individualMessages, groupMessages]);

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
        // ✅ refresh conversations after create
        fetchConversations();
      }
    } catch (e) {
      log('create group error', e);
      if (e?.response?.data) {
        setCreateError(typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data));
      } else {
        setCreateError('Server error while creating group');
      }
    } finally {
      setCreating(false);
    }
  }, [handleSelectChat, fetchConversations]);

  return (
    <ListGroup className="message-list-wrapper">
      {/* ✅ Fetch status bar */}
      {(fetching || fetchErr) && (
        <ListGroup.Item className="list-group-header" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {fetching ? (
            <>
              <Spinner as="span" animation="border" size="sm" /> <span>Loading conversations…</span>
            </>
          ) : (
            <>
              <span style={{ color: 'crimson' }}>Fetch error:</span>
              <span style={{ fontSize: 12 }}>{fetchErr}</span>
              <Button size="sm" variant="outline-primary" onClick={fetchConversations} style={{ marginLeft: 'auto' }}>
                Retry
              </Button>
            </>
          )}
        </ListGroup.Item>
      )}

      {/* ----------------- INDIVIDUAL ----------------- */}
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
            (typeof lastMsgObj === 'object' ? (lastMsgObj?.created_at || lastMsgObj?.timestamp) : null) ||
            null;

          const displayName =
            convo?.first_name || convo?.firstName || convo?.name || convo?.email || `User #${userId ?? '?'}`;

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

          const inlinePreview = !isFriendReqIncoming && !isFriendReqOutgoing ? clip(lastMsgText, 28) : '';

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
