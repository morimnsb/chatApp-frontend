// src/components/HomeChat.jsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Container, Row, Col, Spinner, Alert, Badge } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import './HomeChat.css';

import Header from '@/components/Header';
import BackendPicker from '@/components/BackendPicker';
import LogoutButton from '@/components/auth/LogoutButton';
import MessageList from '@/components/MessageList';
import ChatWindow from '@/components/ChatWindow';
import UserModal from '@/components/UserModal';

import { useBackendChoice, buildEndpoints } from '@/backend/choice';
import useCurrentUser from '@/hooks/useCurrentUser';
import useChatData from '@/hooks/useChatData';

// ✅ فقط هوک سراسری WS (Reverb/Django)
import useGlobalWebSocket from '@/hooks/useGlobalWebSocket';

import {
  selectIndividualMessages,
  selectGroupMessages,
  selectLoading,
  selectError,
  selectTypingIndicators,
} from '@/selectors/messageSelectors';

import { clearUnreadCount, selectRoom } from '@/actions/messageActions';

import {
  useGetMeQuery,
  useGetUsersQuery,
  useSendFriendRequestMutation,
  useRespondFriendRequestMutation,
} from '@/services/apiSlice';

/* ---------- helpers ---------- */

const normalizeUsers = (rawUsers) => {
  if (Array.isArray(rawUsers)) return rawUsers;
  if (Array.isArray(rawUsers?.results)) return rawUsers.results;
  if (Array.isArray(rawUsers?.data)) return rawUsers.data;
  return [];
};

const filterUsersByQuery = (users, query) => {
  const q = (query || '').toLowerCase();
  return users.filter((u) => {
    const name = u.first_name || u.firstName || u.name || u.email || '';
    return name.toLowerCase().includes(q);
  });
};

const normalizeDmList = (individualArray) => {
  const mapped = (individualArray || [])
    .map((item) => {
      const partnerId =
        item.partnerId || item.partner_id || item.user_id || item.id || null;

      const roomId =
        item.roomId ||
        item.room_id ||
        item.chat_room_id ||
        (item.room && item.room.id) ||
        null;

      const first_name =
        item.first_name || item.firstName || item.name || item.email || 'user';

      const last_message =
        item.last_message || item.lastMessage || item.preview || '';

      const last_message_at =
        item.last_message_at ||
        item.lastMessageAt ||
        item.updated_at ||
        item.created_at ||
        null;

      if (!roomId || !partnerId) return null;

      return {
        ...item,
        partnerId,
        roomId,
        first_name,
        last_message,
        last_message_at,
      };
    })
    .filter(Boolean);

  return mapped.sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });
};

const filterDmByQuery = (dmList, query) => {
  const q = (query || '').toLowerCase();
  return dmList.filter((u) => (u.first_name || '').toLowerCase().includes(q));
};

const filterGroupsByQuery = (groupArray, query) => {
  const q = (query || '').toLowerCase();
  return groupArray.filter((r) => (r.name || '').toLowerCase().includes(q));
};

/* ---------- component ---------- */

const HomeChat = () => {
  const dispatch = useDispatch();

  // Redux: chat state
  const individualMessagesMap = useSelector(selectIndividualMessages);
  const groupMessagesMap = useSelector(selectGroupMessages);
  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);
  const typingIndicators = useSelector(selectTypingIndicators);

  // Redux: auth + legacy ws slice (فعلاً برای دیباگ)
  const accessToken = useSelector((s) => s.auth?.token) || '';
  const currentUser =
    useSelector((s) => s.auth?.user ?? s.message?.currentUser) ?? null;
  const wsIsConnected = useSelector((s) => s.ws?.isConnected);
  const wsLastError = useSelector((s) => s.ws?.lastError);

  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Backend choice
  const { backendChoice, effectiveKind, handleChangeBackend } =
    useBackendChoice();
  const rawToken = accessToken || '';
  const bareToken = rawToken.toString().replace(/^Bearer\s+/i, '');
  const backendKind = String(effectiveKind || '').toLowerCase();

  // 🔌 WebSocket سراسری (Reverb / Django)
  const globalWs = useGlobalWebSocket({
    backendKind,
    token: bareToken,
    debugLabel: 'HomeChat',
  });

  const endpoints = useMemo(
    () => buildEndpoints(effectiveKind),
    [effectiveKind],
  );

  // فقط برای دیباگ Toast وقتی Reverb فعاله
  const enableReverbEcho = backendKind === 'reverb' && Boolean(accessToken);

  // Auth bootstrap (legacy / HTTP)
  useCurrentUser({ accessToken, effectiveKind, endpoints });

  // RTK Query (me + users)
  const meQ = useGetMeQuery(undefined, { skip: !accessToken });
  const usersQ = useGetUsersQuery(undefined, { skip: !accessToken });

  const [sendFriendRequest, sendFriendReqState] =
    useSendFriendRequestMutation();

  const [respondFriendRequest, respondFriendReqState] =
    useRespondFriendRequestMutation();

  // Users normalization + filter
  const allUsers = useMemo(() => normalizeUsers(usersQ.data), [usersQ.data]);
  const filteredUsers = useMemo(
    () => filterUsersByQuery(allUsers, searchQuery),
    [allUsers, searchQuery],
  );
  const loadingUsers = usersQ.isLoading;
  const errorUsers = usersQ.error;
  const retryUsers = usersQ.refetch;

  // Chat data bootstrap → conversations → Redux
  const { retryRooms, retryUsers: retryRoomsUsers } = useChatData({
    endpoints,
    accessToken,
  });

  // Derived lists from Redux (individual + groups)
  const individualArray = useMemo(
    () => Object.values(individualMessagesMap || {}),
    [individualMessagesMap],
  );

  const groupArray = useMemo(
    () => Object.values(groupMessagesMap || {}),
    [groupMessagesMap],
  );

  const dmList = useMemo(
    () => normalizeDmList(individualArray),
    [individualArray],
  );

  const filteredIndividualMessages = useMemo(
    () => filterDmByQuery(dmList, searchQuery),
    [dmList, searchQuery],
  );

  const filteredGroupMessages = useMemo(
    () => filterGroupsByQuery(groupArray, searchQuery),
    [groupArray, searchQuery],
  );

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
      if (!userId) return;

      if (currentUser?.id && Number(userId) === Number(currentUser.id)) {
        toast.info("You can't add yourself");
        return;
      }

      if (!accessToken) {
        toast.error('You must be logged in to add friends');
        return;
      }

      try {
        const res = await sendFriendRequest({ to_user_id: userId }).unwrap();
        console.log('friendReq res', res);
        toast.success(res?.message || 'Friendship request sent!');
      } catch (err) {
        console.log('friendReq err', err);
        const msg =
          err?.data?.message ||
          err?.data?.error ||
          err?.error ||
          'Error sending friendship request';
        toast.error(msg);
      }
    },
    [sendFriendRequest, accessToken, currentUser],
  );

  // پاسخ به درخواست دوستی (قبول / رد)
  const handleRespondFriendRequest = useCallback(
    async ({ friendshipId, action }) => {
      if (!friendshipId || !action) return;

      if (!accessToken) {
        toast.error('You must be logged in');
        return;
      }

      try {
        const res = await respondFriendRequest({
          friendship_id: friendshipId,
          action, // 'accept' | 'reject'
        }).unwrap();

        toast.success(res?.message || 'Friend request updated');

        // بعد از accept/reject بهتره دیتا رو رفرش کنیم
        retryRooms(); // کانورسیشن‌ها
        usersQ.refetch?.(); // لیست یوزرها (اگه دوستی‌ها اونجا هم میاد)
        console.log('respondFriendRequest res', res);
      } catch (err) {
        console.log('respondFriendRequest err', err);
        const msg =
          err?.data?.message ||
          err?.data?.error ||
          err?.error ||
          'Error updating friend request';

        toast.error(msg);
      }
    },
    [respondFriendRequest, accessToken, retryRooms, usersQ],
  );

  // Retry button (rooms + users)
  const retryFetch = useCallback(() => {
    retryRooms();
    retryRoomsUsers?.();
    retryUsers?.();
    usersQ.refetch?.();
    meQ.refetch?.();
  }, [retryRooms, retryRoomsUsers, retryUsers, usersQ, meQ]);

  // وضعیت لودینگ/خطا برای سایدبار چپ
  const loadingList = loading;
  const errorList = error;

  /* ---------- 🧪 WebSocket / Global WS Debug Effects ---------- */

  useEffect(() => {
    console.log('[WS DEBUG] backendChoice =', backendChoice);
    console.log('[WS DEBUG] effectiveKind =', effectiveKind);
    console.log('[WS DEBUG] backendKind =', backendKind);
    console.log('[WS DEBUG] enableReverbEcho =', enableReverbEcho);
    console.log('[WS DEBUG] hasAccessToken =', Boolean(accessToken));
  }, [
    backendChoice,
    effectiveKind,
    backendKind,
    enableReverbEcho,
    accessToken,
  ]);

  useEffect(() => {
    console.log('[WS DEBUG] globalWs state =', {
      backend: globalWs.backend,
      status: globalWs.status,
      lastEvent: globalWs.lastEvent,
    });
  }, [globalWs.backend, globalWs.status, globalWs.lastEvent]);

  // وقتی وضعیت اتصال WS عوض می‌شود (legacy ws slice)
  useEffect(() => {
    console.log('[WS DEBUG] wsIsConnected changed =>', wsIsConnected);

    if (wsIsConnected) {
      toast.success('WebSocket connected (legacy ws slice)', {
        toastId: 'ws-connected',
      });
    } else if (enableReverbEcho) {
      toast.info('WebSocket disconnected (legacy slice)', {
        toastId: 'ws-disconnected',
      });
    }
  }, [wsIsConnected, enableReverbEcho]);

  // وقتی خطای WS ثبت شود
  useEffect(() => {
    if (!wsLastError) return;
    console.error('[WS DEBUG] wsLastError =', wsLastError);
    toast.error(`WS error: ${String(wsLastError)}`, {
      toastId: 'ws-error',
    });
  }, [wsLastError]);

  /* ---------- Test helper for GlobalWS ---------- */

  const handleTestSendRaw = useCallback(() => {
    if (!globalWs || typeof globalWs.sendRaw !== 'function') {
      console.warn('[WS DEBUG] globalWs.sendRaw not available');
      return;
    }

    const roomId = selectedRoom || 2;
    const userId = currentUser?.id || 1;

    console.log('[WS DEBUG] Test sendRaw click', {
      roomId,
      userId,
      wsBackend: globalWs.backend,
      wsStatus: globalWs.status,
    });

    globalWs.sendRaw(
      'ClientChatMessage', // event
      `chat.${roomId}`, // channelName
      {
        content: 'hello from GlobalWS',
        user_id: userId,
        room_id: roomId,
      },
    );
  }, [globalWs, selectedRoom, currentUser]);

  return (
    <Container fluid className="messages-container">
      <BackendPicker value={backendChoice} onChange={handleChangeBackend} />
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Chat</h5>
        <LogoutButton />
      </div>
      <div style={{ fontSize: 12, opacity: 0.8, padding: '4px 8px' }}>
        Effective backend: <b>{endpoints.kind}</b> · WS backend:{' '}
        <b>{globalWs.backend || 'off'}</b> · WS status:{' '}
        <b>{globalWs.status || 'off'}</b> · Redux WS:{' '}
        {wsIsConnected ? (
          <Badge bg="success">Connected</Badge>
        ) : (
          <Badge bg="secondary">Disconnected</Badge>
        )}
        {wsLastError && (
          <span style={{ marginLeft: 8, color: 'crimson' }}>
            WS Error: {String(wsLastError)}
          </span>
        )}
        <div style={{ marginTop: 4 }}>
          RTK Query → me:{' '}
          {meQ.isLoading ? 'loading' : meQ.error ? 'error' : 'ok'} · users:{' '}
          {usersQ.isLoading ? 'loading' : usersQ.error ? 'error' : 'ok'}
        </div>
      </div>
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setShowUserDropdown={setShowUserDropdown}
      />

      {/* --- پنل آموزشی/دیباگ کوچک --- */}

      {/* 🟢 حضور آنلاین‌ها - فعلاً خاموش / بعداً وصل می‌کنیم به Reverb presence */}
     

      {/* 🔬 دکمه تست ارسال مستقیم با GlobalWS */}
      <div
        style={{
          fontSize: 12,
          opacity: 0.8,
          padding: '4px 8px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <span>
          GlobalWS backend: <b>{globalWs.backend || 'off'}</b> · status:{' '}
          <b>{globalWs.status || 'off'}</b>
        </span>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={handleTestSendRaw}
          disabled={globalWs.status !== 'connected'}
        >
          Test WS sendRaw
        </button>
      </div>

      <div
        style={{
          fontSize: 12,
          padding: '4px 8px',
          maxHeight: 120,
          overflowY: 'auto',
          borderTop: '1px solid rgba(0,0,0,0.05)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          All users (RTK Query)
        </div>

        {loadingUsers && <div>Loading users…</div>}

        {errorUsers && (
          <div style={{ color: 'crimson' }}>
            Error loading users{' '}
            <button
              className="btn btn-link btn-sm"
              type="button"
              onClick={() => usersQ.refetch?.()}
            >
              retry
            </button>
          </div>
        )}

        {!loadingUsers && !errorUsers && filteredUsers.length === 0 && (
          <div style={{ opacity: 0.7 }}>No users found.</div>
        )}

        {!loadingUsers &&
          !errorUsers &&
          filteredUsers.map((u) => (
            <div
              key={u.id || u.pk || u.email}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '2px 0',
              }}
            >
              <span>
                {u.first_name || u.firstName || u.name || u.email || 'user'}{' '}
                {u.last_name || u.lastName || ''}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                disabled={sendFriendReqState.isLoading}
                onClick={() => handleFriendshipRequest(u.id || u.pk)}
              >
                {sendFriendReqState.isLoading ? 'Sending…' : 'add friend'}
              </button>
            </div>
          ))}
      </div>

      <Row>
        <Col md={4} className="messages-list">
          {loadingList ? (
            <Spinner animation="border" variant="primary" />
          ) : !errorList ? ( // ✅ اگر خطا داریم → Alert
            <Alert variant="danger">
              Error loading data. {String(errorList)}
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
              currentUser={currentUser}
              onRespondFriendRequest={handleRespondFriendRequest}
            />
          )}
        </Col>

        <Col md={8}>
          {selectedRoom && (
            <ChatWindow
              roomId={selectedRoom}
              individualMessages={filteredIndividualMessages}
              groupMessages={filteredGroupMessages}
              endpoints={endpoints}
              accessToken={accessToken}
              effectiveKind={effectiveKind}
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
