// src/components/HomeChat/HomeChat.jsx
import React, { useEffect, useMemo, useReducer } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { useDispatch } from 'react-redux';

import BackendPicker from '@/components/BackendPicker';
import LogoutButton from '@/components/auth/LogoutButton';
import Header from '@/components/Header';
import MessageList from '@/components/MessageList';
import ChatWindow from '@/components/ChatWindow';
import UserModal from '@/components/UserModal';

import { useBackendChoice, buildEndpoints } from '@/backend/choice';
import useChatData from '@/hooks/useChatData';
import { selectRoom, clearUnreadCount } from '@/actions/messageActions';

import Gate from './Gate';

import { useAuthBasics } from '@/hooks/chat/useAuthBasics';
import { useGlobalNotify } from '@/hooks/chat/useGlobalNotify';
import { usePresence } from '@/hooks/chat/usePresence';
import { useUsersQuery } from '@/hooks/chat/useUsersQuery';
import { useChatLists } from '@/hooks/chat/useChatLists';

import useEvent from '@/hooks/useEvent';
import './HomeChat.css';

const STORAGE_KEY = 'homechat:selectedRoomId';
const DEBUG = import.meta.env.DEV === true;

function reducer(state, action) {
  switch (action.type) {
    case 'SET_QUERY':
      return { ...state, q: action.q };
    case 'TOGGLE_USERS':
      return { ...state, showUsers: action.value ?? !state.showUsers };
    case 'SELECT_ROOM':
      return { ...state, roomId: action.roomId ?? null };
    case 'RESTORE_ROOM':
      return { ...state, roomId: action.roomId ?? null, restored: true };
    default:
      return state;
  }
}

const initialState = { q: '', roomId: null, showUsers: false, restored: false };

function EmptyRoom() {
  return (
    <div
      style={{
        minHeight: 320,
        display: 'grid',
        placeItems: 'center',
        border: '1px dashed rgba(255,255,255,0.15)',
        borderRadius: 12,
        padding: 24,
        opacity: 0.9,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>هیچ چتی انتخاب نشده</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>
          از لیست سمت چپ یک گفتگو را انتخاب کن.
        </div>
      </div>
    </div>
  );
}

const toIdStr = (u) => {
  const id = u?.id ?? u?.user_id ?? u?.user?.id ?? u?.pivot?.user_id ?? u;
  return id == null ? null : String(id);
};

export default function HomeChat() {
  const dispatch = useDispatch();
  const [state, ui] = useReducer(reducer, initialState);
  const { q, roomId, showUsers, restored } = state;

  const { backendChoice, effectiveKind, handleChangeBackend } = useBackendChoice();
  const endpoints = useMemo(() => buildEndpoints(effectiveKind), [effectiveKind]);

  const { bareToken, currentUser, currentUserId } = useAuthBasics();

  const { dmList, groupList, typingIndicators, loading, error } = useChatLists({ searchQuery: q });
  const { retryRooms } = useChatData({ endpoints, accessToken: bareToken });

  const onGlobalNotif = useGlobalNotify({
    selectedRoom: roomId,
    setSelectedRoom: (id) => ui({ type: 'SELECT_ROOM', roomId: id }),
  });

  const { onlineUsers } = usePresence({
    backendKind: effectiveKind,
    token: bareToken,
    currentUserId,
    onGlobalNotification: onGlobalNotif,
  });

  // ✅ Set از آنلاین‌ها
  const onlineIdSet = useMemo(() => {
    const set = new Set();
    (Array.isArray(onlineUsers) ? onlineUsers : []).forEach((u) => {
      const s = toIdStr(u);
      if (s) set.add(s);
    });
    return set;
  }, [onlineUsers]);

  // ✅ dmList را enrich کن با is_online
  const dmListWithPresence = useMemo(() => {
    const list = Array.isArray(dmList) ? dmList : [];
    return list.map((convo) => {
      const pid =
        convo?.partnerId ??
        convo?.partner?.id ??
        convo?.user_id ??
        null;

      const isOnline = pid != null ? onlineIdSet.has(String(pid)) : false;
      return { ...convo, is_online: isOnline };
    });
  }, [dmList, onlineIdSet]);

  // --- persist selected room ---
  useEffect(() => {
    if (restored) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? Number(saved) : null;
      if (parsed) {
        ui({ type: 'RESTORE_ROOM', roomId: parsed });
        dispatch(selectRoom(parsed));
      } else {
        ui({ type: 'RESTORE_ROOM', roomId: null });
      }
    } catch {
      ui({ type: 'RESTORE_ROOM', roomId: null });
    }
  }, [dispatch, restored]);

  useEffect(() => {
    try {
      if (roomId) localStorage.setItem(STORAGE_KEY, String(roomId));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [roomId]);

  // --- handlers ---
  const onSelectChat = useEvent((nextRoomId, receiverId) => {
    ui({ type: 'SELECT_ROOM', roomId: nextRoomId });
    dispatch(selectRoom(nextRoomId));
    if (receiverId) dispatch(clearUnreadCount(receiverId));
  });

  const onRetryAll = useEvent(() => {
    retryRooms();
    usersQ.refetch?.();
  });

  const setSearchQuery = useEvent((value) => ui({ type: 'SET_QUERY', q: value }));
  const setShowUsers = useEvent((value) => ui({ type: 'TOGGLE_USERS', value }));

  // users query
  const { usersQ, filteredUsers, handleFriendshipRequest, handleRespondFriendRequest } =
    useUsersQuery({ bareToken, searchQuery: q, retryRooms });

  // ✅ Debug (فقط وقتی تغییر واقعی هست)
  useEffect(() => {
    if (!DEBUG) return;
    console.log('[HomeChat] presence debug', {
      backend: effectiveKind,
      currentUserId,
      onlineUsersCount: Array.isArray(onlineUsers) ? onlineUsers.length : 0,
      onlineIds: Array.from(onlineIdSet),
    });
  }, [DEBUG, effectiveKind, currentUserId, onlineUsers, onlineIdSet]);

  useEffect(() => {
    if (!DEBUG) return;
    console.log('[HomeChat] dm list debug', {
      dmCount: dmListWithPresence.length,
      sample: dmListWithPresence.slice(0, 3).map((x) => ({
        partnerId: x.partnerId,
        roomId: x.roomId,
        is_online: x.is_online,
      })),
    });
  }, [DEBUG, dmListWithPresence]);

  return (
    <Container fluid className="messages-container">
      <BackendPicker value={backendChoice} onChange={handleChangeBackend} />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Chat</h5>
        <LogoutButton />
      </div>

      <Header searchQuery={q} setSearchQuery={setSearchQuery} setShowUserDropdown={setShowUsers} />

      <Row>
        <Col md={4} className="messages-list">
          <Gate loading={loading} error={error} onRetry={onRetryAll}>
            <MessageList
              filteredIndividualMessages={dmListWithPresence}
              filteredGroupMessages={groupList}
              handleSelectChat={onSelectChat}
              selectedRoom={roomId}
              typingIndicators={typingIndicators}
              currentUser={currentUser}
              onRespondFriendRequest={handleRespondFriendRequest}
            />
          </Gate>
        </Col>

        <Col md={8}>
          {roomId ? (
            <ChatWindow
              roomId={roomId}
              endpoints={endpoints}
              effectiveKind={effectiveKind}
              accessToken={bareToken}
              currentUserId={currentUserId}
            />
          ) : (
            <EmptyRoom />
          )}
        </Col>
      </Row>

      <UserModal
        showUserDropdown={showUsers}
        setShowUserDropdown={setShowUsers}
        loadingUsers={usersQ.isLoading}
        errorUsers={usersQ.error}
        currentUser={currentUser}
        filteredUsers={filteredUsers}
        handleFriendshipRequest={handleFriendshipRequest}
      />
    </Container>
  );
}
