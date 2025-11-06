// src/components/HomeChat.js
import React, { useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Container, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './HomeChat.css';

import Header from './Header';
import MessageList from './MessageList';
import ChatWindow from './ChatWindow';
import UserModal from './UserModal';
import BackendPicker from './BackendPicker';

import { useBackendChoice, buildEndpoints } from '../backend/choice';
import useCurrentUser from '../hooks/useCurrentUser';
import useChatData from '../hooks/useChatData';
import useReverbEcho from '../hooks/useReverbEcho';
import useUsers from '../hooks/useUsers';

import {
  selectIndividualMessages,
  selectGroupMessages,
  selectLoading,
  selectError,
  selectTypingIndicators,
} from '../selectors/messageSelectors';

import { clearUnreadCount, selectRoom } from '../actions/messageActions';

const HomeChat = () => {
  const dispatch = useDispatch();

  // Redux selects
  const individualMessagesMap = useSelector(selectIndividualMessages);
  const groupMessagesMap = useSelector(selectGroupMessages);
  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);
  const typingIndicators = useSelector(selectTypingIndicators);

  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Backend choice
  const { backendChoice, effectiveKind, handleChangeBackend } =
    useBackendChoice();
  const endpoints = useMemo(
    () => buildEndpoints(effectiveKind),
    [effectiveKind],
  );

  // Auth & current user
  const accessToken = localStorage.getItem('access_token') || '';
  useCurrentUser({ accessToken, effectiveKind, endpoints });
  const currentUser =
    useSelector((s) => s.auth?.currentUser ?? s.message?.currentUser) ?? null;

  // Fetch users (and filter out current user)
  const { loadingUsers, errorUsers, retryUsers, filteredUsers } = useUsers({
    endpoints,
    accessToken,
    currentUser,
  });

  // Data fetching for conversations/rooms
  const { retryRooms, retryUsers: retryRoomsUsers } = useChatData({
    endpoints,
    accessToken,
  });

  // Echo/Reverb (only when effectiveKind === 'reverb')
  useReverbEcho({ effectiveKind, accessToken });

  // Derived lists
  const individualArray = useMemo(
    () => Object.values(individualMessagesMap || {}),
    [individualMessagesMap],
  );
  const groupArray = useMemo(
    () => Object.values(groupMessagesMap || {}),
    [groupMessagesMap],
  );

  const filteredIndividualMessages = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return individualArray.filter((u) =>
      (u.first_name || '').toLowerCase().includes(q),
    );
  }, [individualArray, searchQuery]);

  const filteredGroupMessages = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return groupArray.filter((r) => (r.name || '').toLowerCase().includes(q));
  }, [groupArray, searchQuery]);

  // Select a chat
  const handleSelectChat = useCallback(
    (roomId, receiverId) => {
      setSelectedRoom(roomId);
      dispatch(selectRoom(roomId));
      if (receiverId) dispatch(clearUnreadCount(receiverId));
    },
    [dispatch],
  );

  // Friendship request
  const handleFriendshipRequest = useCallback(
    async (userId) => {
      try {
        const resp = await fetch(endpoints.friend, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ to_user_id: userId }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(
            data?.error || `Friendship request failed (${resp.status})`,
          );
        }
        toast.success(data?.message || 'Friendship request sent!');
      } catch (e) {
        toast.error(e.message || 'Error sending friendship request');
      }
    },
    [endpoints.friend, accessToken],
  );

  // Retry button (rooms + users)
  const retryFetch = useCallback(() => {
    retryRooms();
    retryRoomsUsers?.();
    retryUsers();
  }, [retryRooms, retryRoomsUsers, retryUsers]);

  return (
    <Container fluid className="messages-container">
      <BackendPicker value={backendChoice} onChange={handleChangeBackend} />

      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setShowUserDropdown={setShowUserDropdown}
      />

      <div style={{ fontSize: 12, opacity: 0.7, padding: '4px 8px' }}>
        Effective backend: <b>{endpoints.kind}</b> · WS mode:{' '}
        <b>{effectiveKind === 'reverb' ? 'Echo/Reverb' : 'Raw/Off'}</b>
      </div>

      <Row>
        <Col md={4} className="messages-list">
          {loading ? (
            <Spinner animation="border" variant="primary" />
          ) : error ? (
            <Alert variant="danger">
              Error loading data.{' '}
              <button className="btn btn-link" onClick={retryFetch}>
                Retry
              </button>
            </Alert>
          ) : (
            <MessageList
              filteredIndividualMessages={filteredIndividualMessages}
              filteredGroupMessages={filteredGroupMessages}
              handleSelectChat={handleSelectChat}
              selectedRoom={selectedRoom}
              typingIndicators={typingIndicators}
            />
          )}
        </Col>
        <Col md={8}>
          {selectedRoom && (
            <ChatWindow
              roomId={selectedRoom}
              individualMessages={filteredIndividualMessages}
              groupMessages={filteredGroupMessages}
              endpoints={endpoints} // ✅
              accessToken={accessToken} // ✅
            />
          )}
        </Col>
      </Row>

      <UserModal
        showUserDropdown={showUserDropdown}
        setShowUserDropdown={setShowUserDropdown}
        loadingUsers={loadingUsers}
        errorUsers={errorUsers}
        currentUser={currentUser}
        filteredUsers={filteredUsers}
        handleSelectChat={handleSelectChat}
        handleFriendshipRequest={handleFriendshipRequest}
        endpoints={endpoints}
        effectiveKind={effectiveKind}
        accessToken={accessToken}
      />

      <ToastContainer />
    </Container>
  );
};

export default HomeChat;
