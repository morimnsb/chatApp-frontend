// chatApp-frontend/src/components/HomeChat.jsx
import React, { useEffect, useMemo, useReducer, useRef, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { getOrCreateEcho } from '@/shared/config/realtime.js';

// ✅ socketClient only (Node)
import { subscribeChatMessage, subscribeTyping, emitTypingIndicator } from '@/shared/ws/socketClient';

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
import useNodeSocket from '@/features/chat/hooks/useNodeSocket.js';
import usePresenceMerge from '@/features/chat/hooks/usePresenceMerge.js';

import './HomeChat.css';

// ✅ Laravel(Reverb) events + router
import { routeRealtimePayload } from '@/features/chat/utils/wsRouter.js';
import { Link } from "react-router-dom";

import useReverbConnState from "@/features/chat/hooks/useReverbConnState";
 import { useRealtimeBus } from "@/features/chat/providers/ChatRealtimeProvider";; // مسیرت رو درست کن
import apiClient from '@/shared/api/apiClient'; // ✅ add

const DEBUG_CHAT =
  import.meta.env.DEV === true && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';

function reducer(state, action) {
  switch (action.type) {
    case 'SET_QUERY':
      return { ...state, q: action.q };
    case 'TOGGLE_USERS':
      return { ...state, showUsers: action.value ?? !state.showUsers };
    case 'SELECT_ROOM':
      return { ...state, roomId: action.roomId ?? null };
    case 'RESET_ROOM':
      return { ...state, roomId: null };
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
        <div style={{ marginTop: 8, opacity: 0.8 }}>از لیست سمت چپ یک گفتگو را انتخاب کن.</div>
      </div>
    </div>
  );
}

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

  // ✅ ChatWindow will register a handler here
  const incomingRef = useRef(null);
  const registerIncoming = useCallback((handler) => {
    incomingRef.current = handler;
    return () => {
      if (incomingRef.current === handler) incomingRef.current = null;
    };
  }, []);
const reverbConnState = useReverbConnState({ backendKind: effectiveKind, token: bareToken });

  const onGlobalNotif = useGlobalNotify({ selectedRoom: roomId });

const realtime = useRealtimeBus();
  // ✅ keep latest room/user ids (fallback)
  const selectedRoomIdRef = useRef(null);
  const currentUserIdRef = useRef(null);
  useEffect(() => {
    selectedRoomIdRef.current = roomId;
  }, [roomId]);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // ✅ wsRouter -> dispatch adapter (routes to ChatWindow + global notify)
  const routerDispatch = useCallback(
    (action) => {
      if (!action || typeof action !== 'object') return;

      switch (action.type) {
        case 'chat/wsTyping': {
          const p = action.payload || {};
          incomingRef.current?.({
            type: 'typing_indicator',
            roomId: p.roomId,
            userId: p.userId,
            isTyping: p.isTyping,
            at: p.at,
          });
          return;
        }

        case 'chat/wsMessage': {
          const p = action.payload || {};
          incomingRef.current?.({
            type: 'message',
            room_id: p.roomId,
            message: p.message,
          });
          return;
        }

        case 'chat/wsNotify': {
          const p = action.payload || {};
          onGlobalNotif?.({
            type: 'notify',
            room_id: p.roomId,
            roomId: p.roomId,
            message: p.message,
          });
          return;
        }

        case 'chat/wsDebug': {
          if (DEBUG_CHAT) console.log('[wsRouter][DBG]', action.payload);
          return;
        }

        default:
          return;
      }
    },
    [onGlobalNotif],
  );

  // ✅ Unified realtime handler (Node + Reverb) -> wsRouter
  const onRealtimePayload = useCallback(
    (payload, meta) => {
      routeRealtimePayload(payload, {
        dispatch: routerDispatch,

        // ✅ meta wins (prevents stale room during switches)
        selectedRoomId: meta?.selectedRoomId ?? selectedRoomIdRef.current,
        currentUserId: meta?.currentUserId ?? currentUserIdRef.current,

        sourceEventName: meta?.eventName ?? meta?.sourceEventName ?? null,
        eventName: meta?.eventName ?? meta?.sourceEventName ?? null,
      });
    },
    [routerDispatch],
  );

  // ✅ Node socket events (route via wsRouter)
  useEffect(() => {
    const isNodeBackend = effectiveKind === 'node' || effectiveKind === 'nest';
    if (!isNodeBackend) return;

    const unsubMsg = subscribeChatMessage((payload) => {
      onRealtimePayload(payload, { eventName: 'chat:message', source: 'node' });
    });

    const unsubTyping = subscribeTyping((payload) => {
      onRealtimePayload(payload, { eventName: 'typing', source: 'node' });
    });

    return () => {
      try {
        unsubMsg?.();
      } catch {}
      try {
        unsubTyping?.();
      } catch {}
    };
  }, [effectiveKind, onRealtimePayload]);

 

useEffect(() => {
  if (!realtime?.registerHandler) return;
  return realtime.registerHandler((payload, meta) => {
    onRealtimePayload(payload, meta);
  });
}, [realtime, onRealtimePayload]);

  // ✅ reset selected room when backend or token changes (avoid wrong room:join)
  const prevCtxRef = useRef({ kind: null, tokenSig: null });
  useEffect(() => {
    const tokenSig = bareToken ? `t:${bareToken.length}` : 't:0';
    const prev = prevCtxRef.current;

    if (prev.kind !== effectiveKind || prev.tokenSig !== tokenSig) {
      prevCtxRef.current = { kind: effectiveKind, tokenSig };
      ui({ type: 'RESET_ROOM' });
      dispatch(selectRoom(null));
    }
  }, [effectiveKind, bareToken, dispatch]);

  // lists
  const { dmList, groupList, typingIndicators, loading, error } = useChatLists({
    searchQuery: q,
    currentUserId,
  });

  // fetch rooms + convos
  const { retryRooms, retryConvos } = useChatData({ endpoints, accessToken: bareToken });

  // users query
  const { usersQ, filteredUsers, handleFriendshipRequest, handleRespondFriendRequest } = useUsersQuery(
    { bareToken, searchQuery: q, retryRooms },
  );

  // Reverb presence
  const { onlineUsers: onlineUsersReverb } = usePresence({
  backendKind: effectiveKind,
  token: bareToken,
  currentUserId,
  onGlobalNotification: onGlobalNotif,
});

const connStateReverb = reverbConnState; // ✅ real Echo connection state


  // Node presence
  const { isNode, connState: connStateNode, onlineUsers: onlineUsersNode } = useNodeSocket({
    effectiveKind,
    selectedRoomId: roomId,
    onNotify: onGlobalNotif,
  });

  // merge presence
  const { onlineUsers, connState, dmListWithPresence } = usePresenceMerge({
    isNode,
    onlineUsersNode,
    connStateNode,
    onlineUsersReverb,
    connStateReverb,
    dmList,
  });

  const onSelectChat = useEvent((nextRoomId, receiverId) => {
    ui({ type: 'SELECT_ROOM', roomId: nextRoomId });
    dispatch(selectRoom(nextRoomId));
    if (receiverId) dispatch(clearUnreadCount(receiverId));
  });

  const onRetryAll = useEvent(() => {
    retryRooms?.();
    retryConvos?.();
    usersQ?.refetch?.();
  });

  const setSearchQuery = useEvent((value) => ui({ type: 'SET_QUERY', q: value }));
  const setShowUsers = useEvent((value) => ui({ type: 'TOGGLE_USERS', value }));

  // debug (no spam)
  const roomsMapDebug = useSelector((s) => s?.messages?.groupMessages);
  const prevDbgRef = useRef({ sig: '' });

  useEffect(() => {
    if (!DEBUG_CHAT) return;

    const sig = stableJson({
      backend: effectiveKind,
      connState,
      roomId,
      roomsKeys: roomsMapDebug ? Object.keys(roomsMapDebug).length : 0,
    });

    if (sig !== prevDbgRef.current.sig) {
      prevDbgRef.current.sig = sig;
      console.log('[HomeChat] ws state', { backend: effectiveKind, connState, roomId });
    }
  }, [effectiveKind, connState, roomId, roomsMapDebug]);

  // ✅ sendTyping contract expected by ChatWindow


const sendTyping = useCallback(
  ({ roomId: rid, isTyping }) => {
    const backend = String(effectiveKind || "").toLowerCase();
    const roomIdNum = Number(rid);

    console.log("[HomeChat][sendTyping] called", { backend, rid, isTyping });

    if (!Number.isFinite(roomIdNum) || roomIdNum <= 0) {
      console.log("[HomeChat][sendTyping] drop: bad roomId", { rid });
      return false;
    }

    // ✅ Node / Nest => socket emit
    if (backend === "node" || backend === "nest") {
      const ok = emitTypingIndicator({ roomId: roomIdNum, isTyping: Boolean(isTyping) });
      console.log("[HomeChat][sendTyping] node emitTypingIndicator =>", { ok, roomId: roomIdNum });
      return ok;
    }

    // ✅ Reverb/Laravel => HTTP POST (+ X-Socket-Id so sender won't receive it)
    if (backend === "reverb") {
      const echo = getOrCreateEcho?.(bareToken);
      const socketId = echo?.connector?.pusher?.connection?.socket_id ?? null;

      console.log("[HomeChat][sendTyping] reverb socketId =>", socketId);

      apiClient
        .post(
          "/chat/typing",
          { room_id: roomIdNum, isTyping: Boolean(isTyping) },
          { headers: socketId ? { "X-Socket-Id": socketId } : {} }
        )
        .then((res) => console.log("[HomeChat][sendTyping] reverb ok", res?.data))
        .catch((e) => console.error("[HomeChat][sendTyping] reverb FAIL", e?.message));

      return true; // fire-and-forget
    }

    console.log("[HomeChat][sendTyping] drop: unsupported backend", { backend });
    return false;
  },
  [effectiveKind, bareToken]
);

  return (
    <Container fluid className="messages-container">
      <Link to="/choose-backend" style={{ textDecoration: "underline" }}>
  Change backend
</Link>
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
              onlineUsers={onlineUsers}
              effectiveKind={effectiveKind}
              loading={loading}
              error={error}
              onRetry={onRetryAll}
            />
          </Gate>
        </Col>

        <Col md={8}>
          {roomId ? (
            <ChatWindow
              key={roomId}
              roomId={roomId}
              effectiveKind={effectiveKind}
              accessToken={bareToken}
              transportStatus={
                isNode ? (connStateNode === 'connected' ? 'connected' : connStateNode) : connStateReverb
              }
              connectionLabel={isNode ? `Socket.IO: ${connStateNode}` : `Reverb: ${connStateReverb}`}
              sendTyping={sendTyping}
              registerIncoming={registerIncoming}
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
