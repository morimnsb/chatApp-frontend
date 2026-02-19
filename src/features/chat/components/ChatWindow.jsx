// chatApp-frontend/src/features/chat/components/ChatWindow.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';

import apiClient, { http } from '@/shared/api/apiClient';
import { resetTypingIndicator, updateMessages } from '@/features/chat/state/messageActions';

import ChatMessagesList from '@/features/chat/components/ChatMessagesList.jsx';
import TypingIndicator from '@/features/chat/components/TypingIndicator.jsx';

import { useAutoScroll } from '@/features/chat/hooks/useAutoScroll.js';
import { useDocTitleBadge } from '@/features/chat/hooks/useDocTitleBadge.js';

/* ----------------------------- helpers ----------------------------- */

const ROOM_TAG = '[ChatWindow]';

const isJwt = (t) => typeof t === 'string' && t.split('.').length === 3;
const stripBearer = (t) => (t || '').toString().replace(/^Bearer\s+/i, '').trim();
const toNum = (v) => (v == null ? null : Number(v));

function normalizeMsg(raw) {
  if (!raw || typeof raw !== 'object') return raw;

  const id = raw.id ?? raw.message_id ?? null;
  const roomId = raw.room_id ?? raw.chat_room_id ?? raw.roomId ?? null;
  const userId = raw.user_id ?? raw.sender_id ?? raw.userId ?? null;

  const content = raw.content ?? raw.text ?? raw.message ?? raw.body ?? null;
  const createdAt = raw.created_at ?? raw.createdAt ?? raw.ts ?? raw.timestamp ?? null;

  return {
    ...raw,
    id,
    room_id: roomId,
    chat_room_id: roomId,
    user_id: userId,
    sender_id: userId,
    content,
    created_at: createdAt,
  };
}

function SelectRoomPlaceholder() {
  return (
    <div className="no-chat-selected">
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>هیچ گفتگویی انتخاب نشده</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>از لیست سمت چپ یک گفتگو را انتخاب کن.</div>
      </div>
    </div>
  );
}

function isCanceled(err) {
  return (
    err?.code === 'ERR_CANCELED' ||
    err?.name === 'CanceledError' ||
    err?.name === 'AbortError' ||
    String(err?.message || '').toLowerCase().includes('canceled')
  );
}

/**
 * ✅ ChatWindow now is PURE UI + HTTP.
 * Realtime comes from parent (HomeChat) via props:
 * - transportStatus
 * - connectionLabel
 * - sendTyping({roomId,isTyping})
 * - registerIncoming(handler)   => parent will forward socket packets here
 */
export default function ChatWindow({
  roomId,
  effectiveKind,
  accessToken: accessTokenProp,

  // ✅ NEW (from HomeChat)
  transportStatus = 'idle',
  connectionLabel = '—',
  sendTyping = () => false,
  registerIncoming = null, // (handler) => unsubscribe()
}) {
  const dispatch = useDispatch();

  const currentUserFromStore = useSelector(
    (s) => s.auth?.currentUser?.id || s.messages?.currentUserId || null,
  );

  const rawToken = accessTokenProp || '';
  const accessToken = stripBearer(rawToken);

  const backend = useMemo(() => String(effectiveKind || '').toLowerCase(), [effectiveKind]);

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [uiError, setUiError] = useState(null);
  const [typingUserId, setTypingUserId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(currentUserFromStore || null);

  // history meta
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const seenMessageIdsRef = useRef(new Set());
  const typingTimeoutRef = useRef(null);

  const lastNotifyAtRef = useRef(0);
  const lastTypingUiAtRef = useRef(0);
  const notifyAudioRef = useRef(null);

  const inputRef = useRef(null);

  const { bump: bumpTitle } = useDocTitleBadge();
  const { containerRef, notifyNewMessage, scrollToBottom, showNewBadge, newCount } =
    useAutoScroll({ enabled: true, bottomThresholdPx: 140 });

  const roomIdNum = useMemo(() => {
    const n = toNum(roomId);
    return Number.isFinite(n) ? n : null;
  }, [roomId]);

  const historyUrl = useMemo(() => {
    if (!roomIdNum) return null;
    if (backend === 'node' || backend === 'nest') return `/chat/messages/${roomIdNum}/`;
    if (backend === 'reverb') return `/chat/messages/${roomIdNum}/`;
    if (backend === 'django' || backend === 'fastapi') return `/chat/messages/${roomIdNum}/`;
    return `/chat/messages/${roomIdNum}/`;
  }, [roomIdNum, backend]);

  const sendUrl = useMemo(() => {
    if (!roomIdNum) return null;
    if (backend === 'node' || backend === 'nest') return `/chat/messages/${roomIdNum}/`;
    if (backend === 'reverb') return `/chat/messages/${roomIdNum}/`;
    if (backend === 'django' || backend === 'fastapi') return `/chat/messages/${roomIdNum}/`;
    return `/chat/messages/${roomIdNum}/`;
  }, [roomIdNum, backend]);

  // ✅ MUST PRINT if this component is actually mounted (no env needed)
  useEffect(() => {
    console.log(ROOM_TAG, 'MOUNT signature=v2026-02-19-consolelog', {
      roomId,
      roomIdNum,
      backend: effectiveKind,
      transportStatus,
      hasRegisterIncoming: typeof registerIncoming === 'function',
      hasSendTyping: typeof sendTyping === 'function',
      baseURL: apiClient?.defaults?.baseURL,
      envDebug: import.meta?.env?.VITE_WS_DEBUG_LEVEL,
    });

    return () => {
      console.log(ROOM_TAG, 'UNMOUNT', { roomId, roomIdNum });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ helpful: track key props changes (no env needed)
  useEffect(() => {
    console.log(ROOM_TAG, 'PROPS', {
      roomId,
      roomIdNum,
      backend,
      transportStatus,
      connectionLabel,
      currentUserFromStore,
    });
  }, [roomId, roomIdNum, backend, transportStatus, connectionLabel, currentUserFromStore]);

  /* -------------------- HARD RESET when room changes -------------------- */
  useEffect(() => {
    setMessages([]);
    setMessageInput('');
    setUiError(null);
    setTypingUserId(null);
    setFetchError(null);

    seenMessageIdsRef.current = new Set();

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = null;

    setTimeout(() => scrollToBottom('auto'), 0);

    console.log(ROOM_TAG, 'ROOM RESET', { roomId, roomIdNum, historyUrl });
  }, [roomId, roomIdNum, scrollToBottom, historyUrl]);

  /* -------------------- notifications init -------------------- */
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    notifyAudioRef.current = new Audio('/sounds/incoming.mp3');
  }, []);

  const showDesktopNotification = useCallback((title, body) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!document.hidden) return;

    try {
      new Notification(title, { body });
    } catch {}
  }, []);

  /* -------------------- currentUserId from store/JWT//me -------------------- */
  useEffect(() => {
    if (currentUserFromStore) {
      setCurrentUserId(currentUserFromStore);
      return;
    }

    if (isJwt(accessToken)) {
      try {
        const dec = jwtDecode(accessToken);
        const id = dec?.user_id ?? dec?.sub ?? null;
        if (id) {
          setCurrentUserId(Number(id));
          console.log(ROOM_TAG, 'currentUserId from JWT', Number(id));
        }
      } catch (e) {
        console.warn(ROOM_TAG, 'JWT decode skipped:', e?.message);
      }
    }
  }, [currentUserFromStore, accessToken]);

  useEffect(() => {
    const needFetchMe = !currentUserId && !!accessToken;
    if (!needFetchMe) return;

    let abort = false;

    (async () => {
      try {
        console.log(ROOM_TAG, 'GET /auth/me (need currentUserId)');
        const me = await http.get('/auth/me');
        if (!abort && me?.id) {
          setCurrentUserId(Number(me.id));
          console.log(ROOM_TAG, 'currentUserId from /auth/me', Number(me.id));
        }
      } catch (e) {
        console.warn(ROOM_TAG, '[me] failed:', e?.message);
      }
    })();

    return () => {
      abort = true;
    };
  }, [currentUserId, accessToken]);

  /* -------------------- history fetch (HTTP) -------------------- */
  useEffect(() => {
    if (!roomIdNum || !historyUrl) return;

    setLoading(true);
    setFetchError(null);
    setUiError(null);

    console.log(ROOM_TAG, 'HISTORY FETCH ->', { historyUrl, baseURL: apiClient?.defaults?.baseURL });

    const { promise, cancel } = http.cancelable.get(historyUrl);

    promise
      .then((data) => {
        let arr = [];
        if (Array.isArray(data)) arr = data;
        else if (Array.isArray(data?.messages)) arr = data.messages;
        else if (Array.isArray(data?.data)) arr = data.data;

        const normalized = arr.map(normalizeMsg).filter((m) => m && m.id != null);

        const seen = new Set();
        for (const m of normalized) if (m?.id) seen.add(m.id);
        seenMessageIdsRef.current = seen;

        setMessages(normalized);

        setTimeout(() => scrollToBottom('auto'), 0);
        console.log(ROOM_TAG, 'HISTORY LOADED', { roomId: roomIdNum, count: normalized.length });
      })
      .catch((e) => {
        if (isCanceled(e)) return;
        console.error(ROOM_TAG, 'history fetch error', e);
        setFetchError(e);
        setUiError('Error fetching messages. Please try again.');
      })
      .finally(() => setLoading(false));

    return () => cancel();
  }, [roomIdNum, historyUrl, scrollToBottom]);

  /* -------------------- incoming realtime from parent -------------------- */
  const handleIncoming = useCallback(
    (packet) => {
      if (!packet) return;

      const type = packet?.type || (packet?.message ? 'message' : 'message');

      // ✅ see every packet type quickly
      console.log(ROOM_TAG, 'INCOMING packet', {
        type,
        roomIdNum,
        packetRoom: packet?.room_id ?? packet?.roomId ?? packet?.chat_room_id ?? packet?.message?.chat_room_id ?? null,
      });

      if (type === 'message') {
        const m = normalizeMsg(packet?.message ?? packet);

        const packetRoomId = toNum(m?.room_id ?? m?.chat_room_id);
        if (roomIdNum && packetRoomId && packetRoomId !== roomIdNum) return;

        if (m?.id && !seenMessageIdsRef.current.has(m.id)) {
          seenMessageIdsRef.current.add(m.id);
          setMessages((prev) => [...prev, m]);
          notifyNewMessage();
        }

        dispatch(updateMessages({ type: 'message', room_id: packetRoomId ?? roomIdNum, message: m }));

        const senderId = m?.sender_id;
        const mine = Number(currentUserId);

        if (senderId && mine && Number(senderId) !== mine) {
          const now = Date.now();
          if (now - lastNotifyAtRef.current > 1200) {
            lastNotifyAtRef.current = now;
            toast?.info(m?.content ?? 'پیام جدید');
            notifyAudioRef.current?.play().catch(() => {});
            showDesktopNotification('پیام جدید', m?.content || '');
            bumpTitle(1);
          }
        }
        return;
      }

      if (type === 'typing_indicator' || type === 'typing') {
        console.log(ROOM_TAG, 'INCOMING typing', packet);

        const uid = packet.user_id ?? packet.userId ?? packet.sender_id ?? null;
        const rid = toNum(packet.room_id ?? packet.roomId ?? packet.chat_room_id ?? null);

        if (roomIdNum && rid && rid !== roomIdNum) return;
        if (!uid) return;

        const isTyping = Boolean(packet.isTyping);

        // stop -> turn off immediately
        if (!isTyping) {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
          dispatch(resetTypingIndicator(uid));
          setTypingUserId(null);
          return;
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setTypingUserId(uid);

        typingTimeoutRef.current = setTimeout(() => {
          dispatch(resetTypingIndicator(uid));
          setTypingUserId(null);
          typingTimeoutRef.current = null;
        }, 3500);
      }
    },
    [dispatch, currentUserId, notifyNewMessage, showDesktopNotification, bumpTitle, roomIdNum],
  );

  useEffect(() => {
    if (typeof registerIncoming !== 'function') {
      console.log(ROOM_TAG, 'registerIncoming is NOT a function -> realtime will not arrive');
      return;
    }

    console.log(ROOM_TAG, 'registerIncoming attached ✅');
    const unsub = registerIncoming(handleIncoming);

    return () => {
      console.log(ROOM_TAG, 'registerIncoming detached');
      try {
        unsub?.();
      } catch {}
    };
  }, [registerIncoming, handleIncoming]);

  useEffect(() => {
    if (transportStatus === 'connected') {
      setTimeout(() => inputRef.current?.focus?.(), 0);
    }
  }, [transportStatus, roomIdNum]);

  /* -------------------- send message (HTTP only) -------------------- */
  const readyToSend =
    Boolean(roomIdNum) &&
    Number.isFinite(Number(currentUserId)) &&
    transportStatus === 'connected';

  const handleSendMessage = useCallback(
    async (e) => {
      e.preventDefault();

      const text = String(messageInput || '').trim();
      setUiError(null);

      console.log(ROOM_TAG, 'SEND submit', {
        roomId: roomIdNum,
        currentUserId,
        transportStatus,
        textLen: text.length,
      });

      if (!currentUserId) return setUiError('User not ready yet.');
      if (!text) return setUiError('Message cannot be empty');
      if (transportStatus !== 'connected') return setUiError('Realtime is not connected yet.');

      try {
        // ✅ stop typing on send
        console.log(ROOM_TAG, 'SEND -> stop typing', { roomId: roomIdNum });
        sendTyping?.({ roomId: roomIdNum, isTyping: false });

        await apiClient.post(sendUrl, { text, kind: null });
        setMessageInput('');
        setTimeout(() => scrollToBottom('smooth'), 0);
      } catch (e2) {
        console.error(ROOM_TAG, 'sendMessage failed', e2);
        setUiError(e2?.message || 'Failed to send message');
      }
    },
    [messageInput, transportStatus, roomIdNum, currentUserId, scrollToBottom, sendUrl, sendTyping],
  );

  /* -------------------- typing (UI throttle) -------------------- */
  const handleInputChange = useCallback(
    (e) => {
      const val = e.target.value;
      setMessageInput(val);

      console.log(ROOM_TAG, 'INPUT change', {
        roomId: roomIdNum,
        currentUserId,
        transportStatus,
        len: String(val || '').length,
      });

      if (!currentUserId) {
        console.log(ROOM_TAG, 'typing SKIP: no currentUserId');
        return;
      }
      if (!roomIdNum) {
        console.log(ROOM_TAG, 'typing SKIP: no roomIdNum');
        return;
      }
      if (transportStatus !== 'connected') {
        console.log(ROOM_TAG, 'typing SKIP: transport not connected', { transportStatus });
        return;
      }

      // empty => stop
      if (!val.trim()) {
        console.log(ROOM_TAG, 'typing OUT stop (empty)', { roomId: roomIdNum });
        sendTyping?.({ roomId: roomIdNum, isTyping: false });
        return;
      }

      // throttle typing=true
      const now = Date.now();
      if (now - lastTypingUiAtRef.current < 800) {
        console.log(ROOM_TAG, 'typing THROTTLED', { delta: now - lastTypingUiAtRef.current });
        return;
      }
      lastTypingUiAtRef.current = now;

      console.log(ROOM_TAG, 'typing OUT start', { roomId: roomIdNum });
      sendTyping?.({ roomId: roomIdNum, isTyping: true });
    },
    [currentUserId, roomIdNum, transportStatus, sendTyping],
  );

  /* -------------------- render -------------------- */
  if (!roomIdNum) return <SelectRoomPlaceholder />;
  if (!currentUserId) return <div>Loading user...</div>;

  return (
    <div className="chat-window chat-window--full">
      {loading && (
        <div className="loading-spinner">
          <Spinner animation="border" />
        </div>
      )}

      {uiError && <Alert variant="danger">{uiError}</Alert>}

      <div className="connection-status">
        {connectionLabel || '—'}
        <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 8 }}>
          {ROOM_TAG} roomId={roomIdNum} backend={String(effectiveKind)} status={transportStatus}
        </span>
      </div>

      <div className="chat-window__body">
        <div className="chat-window__messagesWrap">
          {import.meta.env.DEV && (
            <div style={{ padding: 8, fontSize: 12, opacity: 0.85 }}>
              <div><b>roomId:</b> {roomIdNum}</div>
              <div><b>currentUserId:</b> {String(currentUserId)}</div>
              <div><b>messages.length:</b> {messages?.length ?? 0}</div>
              <div><b>historyUrl:</b> {String(historyUrl || '—')}</div>
              <div><b>baseURL:</b> {String(apiClient?.defaults?.baseURL || '—')}</div>
              <div><b>sample:</b> {messages?.[0] ? JSON.stringify(messages[0]).slice(0, 220) + '…' : '—'}</div>
              {fetchError && (
                <div style={{ color: 'crimson' }}>
                  <b>fetchError:</b> {String(fetchError?.message || fetchError)}
                </div>
              )}
            </div>
          )}

          <ChatMessagesList
            messages={messages}
            currentUserId={currentUserId}
            containerRef={containerRef}
          />

          {showNewBadge && (
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
              className="chat-window__newBadge"
            >
              New messages ({newCount})
            </button>
          )}
        </div>

        <TypingIndicator typing={typingUserId} />

        <Form onSubmit={handleSendMessage} className="chat-input-form">
          <Form.Group controlId="messageInput">
            <Form.Control
              ref={inputRef}
              type="text"
              placeholder={currentUserId ? 'Type a message...' : 'Loading user…'}
              value={messageInput}
              onChange={handleInputChange}
              disabled={!currentUserId || transportStatus !== 'connected'}
              onBlur={() => {
                console.log(ROOM_TAG, 'INPUT blur -> stop typing', { roomId: roomIdNum });
                sendTyping?.({ roomId: roomIdNum, isTyping: false });
              }}
            />
          </Form.Group>

          <Button type="submit" variant="primary" disabled={!readyToSend || !messageInput.trim()}>
            Send
          </Button>
        </Form>
      </div>
    </div>
  );
}
