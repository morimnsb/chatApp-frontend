// chatApp-frontend\src\features\chat\components\HomeChat.tsx
// chatApp-frontend/src/features/chat/components/HomeChat.tsx
import React, { useEffect, useMemo, useReducer, useRef, useCallback } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { Link } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import type { RootState } from "@/app/store/store";
import type { BackendKey } from "@/shared/backend";
import { useBackendChoice, buildEndpoints } from "@/shared/backend";

import { getOrCreateEcho } from "@/shared/config/realtime.js";

// Node socket client
import { subscribeChatMessage, subscribeTyping, emitTypingIndicator } from "@/shared/ws/socketClient";

import LogoutButton from "@/features/auth/components/LogoutButton.jsx";
import Header from "@/shared/components/Header";
import ConversationList from "@/shared/components/ConversationList";
import ChatWindow from "@/features/chat/components/ChatWindow.jsx";
import UserModal from "@/shared/components/UserModal";

import useChatData from "@/features/chat/hooks/useChatData.js";
import { selectRoom, clearUnreadCount } from "@/features/chat/state/messageActions";

import Gate from "./Gate";

import { useAuthBasics } from "@/features/auth/hooks/useAuthBasics.js";
import { useGlobalNotify } from "@/features/chat/hooks/useGlobalNotify.js";
import { usePresence } from "@/features/chat/hooks/usePresence.js";
import { useUsersQuery } from "@/features/chat/hooks/useUsersQuery.js";
import { useChatLists } from "@/features/chat/hooks/useChatLists.js";

import useEvent from "@/shared/hooks/useEvent.js";
import useNodeSocket from "@/features/chat/hooks/useNodeSocket.js";
import usePresenceMerge from "@/features/chat/hooks/usePresenceMerge.js";

import "./HomeChat.css";

import { routeRealtimePayload } from "@/features/chat/utils/wsRouter.js";

import useReverbConnState from "@/features/chat/hooks/useReverbConnState";
import { useRealtimeBus } from "@/features/chat/providers/ChatRealtimeProvider";
import apiClient from "@/shared/api/apiClient";

// ----------------------------- types (local) -----------------------------

type UiState = {
  q: string;
  roomId: number | null;
  showUsers: boolean;
};

type UiAction =
  | { type: "SET_QUERY"; q: string }
  | { type: "TOGGLE_USERS"; value?: boolean }
  | { type: "SELECT_ROOM"; roomId?: number | null }
  | { type: "RESET_ROOM" };

type IncomingHandler = (evt: any) => void;

type WsRouterAction =
  | { type: "chat/wsTyping"; payload?: any }
  | { type: "chat/wsMessage"; payload?: any }
  | { type: "chat/wsNotify"; payload?: any }
  | { type: "chat/wsDebug"; payload?: any }
  | { type: string; payload?: any };

type SendTypingArgs = { roomId: number | string; isTyping: boolean };

// ----------------------------- constants -----------------------------

const DEBUG_CHAT =
  import.meta.env.DEV === true && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";

const initialState: UiState = { q: "", roomId: null, showUsers: false };

function reducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case "SET_QUERY":
      return { ...state, q: action.q };
    case "TOGGLE_USERS":
      return { ...state, showUsers: action.value ?? !state.showUsers };
    case "SELECT_ROOM":
      return { ...state, roomId: action.roomId ?? null };
    case "RESET_ROOM":
      return { ...state, roomId: null };
    default:
      return state;
  }
}

function EmptyRoom() {
  return (
    <div
      style={{
        minHeight: 320,
        display: "grid",
        placeItems: "center",
        border: "1px dashed rgba(255,255,255,0.15)",
        borderRadius: 12,
        padding: 24,
        opacity: 0.9,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>هیچ چتی انتخاب نشده</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>از لیست سمت چپ یک گفتگو را انتخاب کن.</div>
      </div>
    </div>
  );
}

const stableJson = (x: unknown): string => {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
};

export default function HomeChat() {
  const dispatch = useAppDispatch();
  const [state, ui] = useReducer(reducer, initialState);
  const { q, roomId, showUsers } = state;

  const { effectiveKind } = useBackendChoice(); // BackendKey
  const endpoints = useMemo(() => buildEndpoints(effectiveKind), [effectiveKind]);

  const { bareToken, currentUser, currentUserId } = useAuthBasics();

  const incomingRef = useRef<IncomingHandler | null>(null);
  const registerIncoming = useCallback((handler: IncomingHandler) => {
    incomingRef.current = handler;
    return () => {
      if (incomingRef.current === handler) incomingRef.current = null;
    };
  }, []);

  const reverbConnState = useReverbConnState({
    backendKind: effectiveKind,
    token: bareToken,
  });

  const onGlobalNotif = useGlobalNotify({ selectedRoom: roomId });
  const realtime = useRealtimeBus();

  const selectedRoomIdRef = useRef<number | null>(null);
  const currentUserIdRef = useRef<number | null>(null);

  useEffect(() => {
    selectedRoomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId ?? null;
  }, [currentUserId]);

  const routerDispatch = useCallback(
    (action: WsRouterAction) => {
      if (!action || typeof action !== "object") return;

      switch (action.type) {
        case "chat/wsTyping": {
          const p = action.payload || {};
          incomingRef.current?.({
            type: "typing_indicator",
            roomId: p.roomId,
            userId: p.userId,
            isTyping: p.isTyping,
            at: p.at,
          });
          return;
        }

        case "chat/wsMessage": {
          const p = action.payload || {};
          incomingRef.current?.({
            type: "message",
            room_id: p.roomId,
            message: p.message,
          });
          return;
        }

        case "chat/wsNotify": {
          const p = action.payload || {};
          onGlobalNotif?.({
            type: "notify",
            room_id: p.roomId,
            roomId: p.roomId,
            message: p.message,
          });
          return;
        }

        case "chat/wsDebug": {
          if (DEBUG_CHAT) console.log("[wsRouter][DBG]", action.payload);
          return;
        }

        default:
          return;
      }
    },
    [onGlobalNotif]
  );

  const onRealtimePayload = useCallback(
    (payload: any, meta?: any) => {
      routeRealtimePayload(payload, {
        dispatch: routerDispatch,
        selectedRoomId: meta?.selectedRoomId ?? selectedRoomIdRef.current,
        currentUserId: meta?.currentUserId ?? currentUserIdRef.current,
        sourceEventName: meta?.eventName ?? meta?.sourceEventName ?? null,
        eventName: meta?.eventName ?? meta?.sourceEventName ?? null,
      });
    },
    [routerDispatch]
  );

  useEffect(() => {
    const isNodeBackend = effectiveKind === "node";
    if (!isNodeBackend) return;

    const unsubMsg = subscribeChatMessage((payload: any) => {
      onRealtimePayload(payload, { eventName: "chat:message", source: "node" });
    });

    const unsubTyping = subscribeTyping((payload: any) => {
      onRealtimePayload(payload, { eventName: "typing", source: "node" });
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
    return realtime.registerHandler((payload: any, meta: any) => {
      onRealtimePayload(payload, meta);
    });
  }, [realtime, onRealtimePayload]);

  const prevCtxRef = useRef<{ kind: BackendKey | null; tokenSig: string | null }>({
    kind: null,
    tokenSig: null,
  });

  useEffect(() => {
    const tokenSig = bareToken ? `t:${bareToken.length}` : "t:0";
    const prev = prevCtxRef.current;

    if (prev.kind !== effectiveKind || prev.tokenSig !== tokenSig) {
      prevCtxRef.current = { kind: effectiveKind, tokenSig };
      ui({ type: "RESET_ROOM" });
      dispatch(selectRoom(null));
    }
  }, [effectiveKind, bareToken, dispatch]);

  const { dmList, groupList, typingIndicators, loading, error } = useChatLists({
    searchQuery: q,
    currentUserId,
  });

  const { retryRooms, retryConvos } = useChatData({
    endpoints,
    accessToken: bareToken,
  });

  const { usersQ, filteredUsers, handleFriendshipRequest, handleRespondFriendRequest } =
    useUsersQuery({ bareToken, searchQuery: q, retryRooms });

  const { onlineUsers: onlineUsersReverb } = usePresence({
    backendKind: effectiveKind,
    token: bareToken,
    currentUserId,
    onGlobalNotification: onGlobalNotif,
  });

  const connStateReverb = reverbConnState;

  const { isNode, connState: connStateNode, onlineUsers: onlineUsersNode } = useNodeSocket({
    effectiveKind,
    selectedRoomId: roomId,
    onNotify: onGlobalNotif,
  });

  const { onlineUsers, connState, dmListWithPresence } = usePresenceMerge({
    isNode,
    onlineUsersNode,
    connStateNode,
    onlineUsersReverb,
    connStateReverb,
    dmList,
  });

  const onSelectChat = useEvent((nextRoomId: number, receiverId?: number) => {
    ui({ type: "SELECT_ROOM", roomId: nextRoomId });
    dispatch(selectRoom(nextRoomId));
    if (receiverId) dispatch(clearUnreadCount(receiverId));
  });

  const onRetryAll = useEvent(() => {
    retryRooms?.();
    retryConvos?.();
    usersQ?.refetch?.();
  });

  const setSearchQuery = useEvent((value: string) => ui({ type: "SET_QUERY", q: value }));
  const setShowUsers = useEvent((value?: boolean) => ui({ type: "TOGGLE_USERS", value }));

  const roomsMapDebug = useAppSelector((s: RootState) => (s as any).messages?.groupMessages);
  const prevDbgRef = useRef<{ sig: string }>({ sig: "" });

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
      console.log("[HomeChat] ws state", { backend: effectiveKind, connState, roomId });
    }
  }, [effectiveKind, connState, roomId, roomsMapDebug]);

  const sendTyping = useCallback(
    ({ roomId: rid, isTyping }: SendTypingArgs) => {
      const backend = effectiveKind;
      const roomIdNum = Number(rid);

      if (!Number.isFinite(roomIdNum) || roomIdNum <= 0) return false;

      if (backend === "node") {
        return emitTypingIndicator({ roomId: roomIdNum, isTyping: Boolean(isTyping) });
      }

      if (backend === "reverb") {
        const echo = (getOrCreateEcho as any)?.(bareToken);
        const socketId = echo?.connector?.pusher?.connection?.socket_id ?? null;

        apiClient
          .post(
            "/chat/typing",
            { room_id: roomIdNum, isTyping: Boolean(isTyping) },
            { headers: socketId ? { "X-Socket-Id": socketId } : {} }
          )
          .catch(() => {});

        return true;
      }

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
                isNode ? (connStateNode === "connected" ? "connected" : connStateNode) : connStateReverb
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