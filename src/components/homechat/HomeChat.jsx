// src/components/HomeChat/HomeChat.jsx
import React, { useState } from 'react';
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

export default function HomeChat() {
  const dispatch = useDispatch();

  const [q, setQ] = useState('');
  const [room, setRoom] = useState(null);
  const [showUsers, setShowUsers] = useState(false);

  const { backendChoice, effectiveKind, handleChangeBackend } = useBackendChoice();
  const endpoints = buildEndpoints(effectiveKind);

  const { bareToken, currentUser, currentUserId } = useAuthBasics();
  const { dmList, groupList, typingIndicators, loading, error } = useChatLists({ searchQuery: q });
  const { retryRooms } = useChatData({ endpoints, accessToken: bareToken });

  const onGlobalNotif = useGlobalNotify({ selectedRoom: room, setSelectedRoom: setRoom });
  usePresence({ backendKind: effectiveKind, token: bareToken, currentUserId, onGlobalNotification: onGlobalNotif });

  const { usersQ, filteredUsers, handleFriendshipRequest, handleRespondFriendRequest } =
    useUsersQuery({ bareToken, searchQuery: q, retryRooms });

  const onSelectChat = useEvent((roomId, receiverId) => {
    setRoom(roomId);
    dispatch(selectRoom(roomId));
    if (receiverId) dispatch(clearUnreadCount(receiverId));
  });

  const onRetryAll = useEvent(() => {
    retryRooms();
    usersQ.refetch?.();
  });

  return (
    <Container fluid className="messages-container">
      <BackendPicker value={backendChoice} onChange={handleChangeBackend} />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Chat</h5>
        <LogoutButton />
      </div>

      <Header searchQuery={q} setSearchQuery={setQ} setShowUserDropdown={setShowUsers} />

      <Row>
        <Col md={4} className="messages-list">
          <Gate loading={loading} error={error} onRetry={onRetryAll}>
            <MessageList
              filteredIndividualMessages={dmList}
              filteredGroupMessages={groupList}
              handleSelectChat={onSelectChat}
              selectedRoom={room}
              typingIndicators={typingIndicators}
              currentUser={currentUser}
              onRespondFriendRequest={handleRespondFriendRequest}
            />
          </Gate>
        </Col>

        <Col md={8}>
          {!!room && (
            <ChatWindow
              roomId={room}
              individualMessages={dmList}
              groupMessages={groupList}
              endpoints={endpoints}
              accessToken={bareToken}
              effectiveKind={effectiveKind}
            />
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
