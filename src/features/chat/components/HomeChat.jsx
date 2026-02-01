// src/components/HomeChat.jsx
import React, { useEffect, useMemo, useReducer, useRef } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';

import LogoutButton from '@/features/auth/components/LogoutButton.jsx';
import Header from '@/shared/components/Header';
import ConversationList from '@/shared/components/ConversationList';
import ChatWindow from '@/features/chat/components/ChatWindow.jsx';
import UserModal from '@/shared/components/UserModal';

import { useBackendChoice, buildEndpoints } from '@/shared/backend';
import useChatData from '@/features/chat/hooks/useChatData.js';
import { selectRoom, clearUnreadCount } from '@/features/chat/state/messageActions';

import Gate from './Gate';

import { useAuthBasics } from '@/features/auth/hooks/useAuthBasics.js';
import { useGlobalNotify } from '@/features/chat/hooks/useGlobalNotify.js';
import { usePresence } from '@/features/chat/hooks/usePresence.js';
import { useUsersQuery } from '@/features/chat/hooks/useUsersQuery.js';
import { useChatLists } from '@/features/chat/hooks/useChatLists.js';

import useEvent from '@/shared/hooks/useEvent.js';
import './HomeChat.css';

const DEBUG_CHAT =
  import.meta.env.DEV === true &&
  String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';

function reducer(state, action) {
  switch (action.type) {
    case 'SET_QUERY':
      return { ...state, q: action.q };
    case 'TOGGLE_USERS':
      return { ...state, showUsers: action.value ?? !state.showUsers };
    case 'SELECT_ROOM':
      return { ...state, roomId: action.roomId ?? null };
    default:
      return state;
  }
}

const initialState = { q: '', roomId: null, showUsers: false };

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

const safeLen = (arr) => (Array.isArray(arr) ? arr.length : 0);
const stableJson = (x) => {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
};

export default function HomeChat() {
  const dispatch = useDispatch();
  const [state, ui] = useReducer(reducer, initialState);
  const { q, roomId, showUsers } = state;

  const { effectiveKind } = useBackendChoice();
const endpoints = useMemo(() => buildEndpoints(effectiveKind), [effectiveKind]);



  const { bareToken, currentUser, currentUserId } = useAuthBasics();

  // lists
  const { dmList, groupList, typingIndicators, loading, error } = useChatLists({
    searchQuery: q,
    currentUserId,
  });

  // ✅ useChatData خودش fetch می‌کند (دیگر اینجا retry خودکار نمی‌زنیم)
  const { retryRooms, retryConvos } = useChatData({ endpoints, accessToken: bareToken });

  // ✅ store debug
  const roomsMapDebug = useSelector((s) => s?.messages?.groupMessages);
  useEffect(() => {
    if (!DEBUG_CHAT) return;
    console.log('[HomeChat] store rooms keys', {
      slice: roomsMapDebug ? 'messages.groupMessages' : 'missing',
      keys: roomsMapDebug ? Object.keys(roomsMapDebug).slice(0, 8) : null,
    });
  }, [roomsMapDebug]);

  // users query
  const { usersQ, filteredUsers, handleFriendshipRequest, handleRespondFriendRequest } =
    useUsersQuery({ bareToken, searchQuery: q, retryRooms });

  const onGlobalNotif = useGlobalNotify({
    selectedRoom: roomId,
    setSelectedRoom: (id) => ui({ type: 'SELECT_ROOM', roomId: id }),
  });

  const { onlineUsers, connState } = usePresence({
    backendKind: effectiveKind,
    token: bareToken,
    currentUserId,
    onGlobalNotification: onGlobalNotif,
  });

  const onlineIdSet = useMemo(() => {
    const set = new Set();
    (Array.isArray(onlineUsers) ? onlineUsers : []).forEach((u) => {
      const s = toIdStr(u);
      if (s) set.add(s);
    });
    return set;
  }, [onlineUsers]);

  const dmListWithPresence = useMemo(() => {
    const list = Array.isArray(dmList) ? dmList : [];
    return list.map((convo) => {
      const pid = convo?.partnerId ?? convo?.partner?.id ?? convo?.user_id ?? null;
      const isOnline = pid != null ? onlineIdSet.has(String(pid)) : false;
      return { ...convo, is_online: isOnline };
    });
  }, [dmList, onlineIdSet]);

  const onSelectChat = useEvent((nextRoomId, receiverId) => {
    ui({ type: 'SELECT_ROOM', roomId: nextRoomId });
    dispatch(selectRoom(nextRoomId));
    if (receiverId) dispatch(clearUnreadCount(receiverId));
  });

  const onRetryAll = useEvent(() => {
    retryRooms?.();
    retryConvos?.();
    usersQ.refetch?.();
  });

  const setSearchQuery = useEvent((value) => ui({ type: 'SET_QUERY', q: value }));
  const setShowUsers = useEvent((value) => ui({ type: 'TOGGLE_USERS', value }));

  // =========================
  // ✅ DEBUGS (no spam)
  // =========================
  const prevRef = useRef({ state: '', presence: '', dm: '', usersQ: '', conn: '' });

  useEffect(() => {
    if (!DEBUG_CHAT) return;
    const sig = stableJson({ connState });
    if (sig !== prevRef.current.conn) {
      prevRef.current.conn = sig;
      console.log('[HomeChat] ws state', { connState });
    }
  }, [connState]);

  useEffect(() => {
    if (!DEBUG_CHAT) return;

    const payload = {
      backend: effectiveKind,
      roomId,
      qLen: (q || '').length,
      currentUserId,
      hasToken: Boolean(bareToken),
      roomsUrl: endpoints?.rooms,
      convosUrl: endpoints?.convos,
    };
    const sig = stableJson(payload);

    if (sig !== prevRef.current.state) {
      prevRef.current.state = sig;
      console.log('[HomeChat] state signature', payload);
    }
  }, [effectiveKind, roomId, q, currentUserId, bareToken, endpoints]);

  useEffect(() => {
    if (!DEBUG_CHAT) return;

    const ids = Array.from(onlineIdSet);
    const payload = {
      backend: effectiveKind,
      currentUserId,
      onlineCount: ids.length,
      onlineIds: ids,
    };
    const sig = stableJson(payload);

    if (sig !== prevRef.current.presence) {
      prevRef.current.presence = sig;
      console.log('[HomeChat] presence', payload);
    }
  }, [effectiveKind, currentUserId, onlineIdSet]);

  useEffect(() => {
    if (!DEBUG_CHAT) return;

    const sample = dmListWithPresence.slice(0, 3).map((x) => ({
      roomId: x.roomId ?? x.id ?? null,
      partnerId: x.partnerId ?? x?.partner?.id ?? x?.user_id ?? null,
      is_online: Boolean(x.is_online),
    }));

    const payload = { dmCount: dmListWithPresence.length, sample };
    const sig = stableJson(payload);

    if (sig !== prevRef.current.dm) {
      prevRef.current.dm = sig;
      console.log('[HomeChat] dm list', payload);
    }
  }, [dmListWithPresence]);

  useEffect(() => {
    if (!DEBUG_CHAT) return;

    const payload = {
      isLoading: Boolean(usersQ?.isLoading),
      isFetching: Boolean(usersQ?.isFetching),
      hasError: Boolean(usersQ?.error),
      filteredUsersCount: safeLen(filteredUsers),
    };
    const sig = stableJson(payload);

    if (sig !== prevRef.current.usersQ) {
      prevRef.current.usersQ = sig;
      console.log('[HomeChat] usersQ', payload);
    }
  }, [usersQ?.isLoading, usersQ?.isFetching, usersQ?.error, filteredUsers]);

  return (
    <Container fluid className="messages-container">

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Chat</h5>
        <LogoutButton />
      </div>

      <Header searchQuery={q} setSearchQuery={setSearchQuery} setShowUserDropdown={setShowUsers} />

      <Row>
        <Col md={4} className="messages-list">
          <Gate loading={loading} error={error} onRetry={onRetryAll}>
            <ConversationList
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
              key={roomId}
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
        loadingUsers={usersQ?.isLoading}
        errorUsers={usersQ?.error}
        currentUser={currentUser}
        filteredUsers={filteredUsers}
        handleFriendshipRequest={handleFriendshipRequest}
      />
    </Container>
  );
}















