import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import { useDispatch } from 'react-redux';
import {
  updateMessages,
  resetTypingIndicator,
} from '@/../../actions/messageActions';
import { stripBearer } from '@/../../utils/jwt';
import { buildWsUrlForDjango } from '@/../../utils/wsUrl';
import useChatWebSocket from '@/../../hooks/useChatWebSocket';
import useCurrentUser from '@/hooks/useCurrentUser';
import useRoomMessages from '@/hooks/useRoomMessages';
import useDesktopNotify from '@/hooks/useDesktopNotify';
import useTitleBadge from '@/hooks/useTitleBadge';
import useTypingEcho from '@/hooks/useTypingEcho';
import MessageList from '@/MessageList';
import TypingIndicator from '@/TypingIndicator';

// --- helpers (module-scope) ---
const coerceId = (v) => (v == null ? null : Number(v) || String(v));
const normPacket = (packet) => {
  if (!packet) return null;
  if (packet.type === 'message' && !packet.message && packet.data) {
    return { ...packet, message: packet.data };
  }
  return packet;
};
const msgKey = (m) => `${coerceId(m?.id)}|${coerceId(m?.room_id)}`;

console.log('module loaded');

const ChatWindow = ({ roomId, endpoints, effectiveKind }) => {
  const dispatch = useDispatch();
  const IS_DJANGO = String(effectiveKind || '').toLowerCase() === 'django';
  const IS_REVERB = String(effectiveKind || '').toLowerCase() === 'reverb';

  const [messageInput, setMessageInput] = useState('');
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');

  const seenMessageIdsRef = useRef(new Set());
  const timeoutRef = useRef(null);
  const sendJsonMessageRef = useRef(null);

  const rawToken = localStorage.getItem('access_token') || '';
  const accessToken = stripBearer(rawToken);
  const currentUserId = useCurrentUser(accessToken, endpoints);

  const { messages, setMessages, loading, fetchError } = useRoomMessages(
    roomId,
    endpoints,
    accessToken,
  );

  const { show } = useDesktopNotify();
  const { bump } = useTitleBadge();

  useEffect(() => {
    console.log('[ChatWindow] mounted', {
      roomId,
      effectiveKind,
      IS_DJANGO,
      IS_REVERB,
    });
    return () => console.log('[ChatWindow] unmounted');
  }, [roomId, effectiveKind, IS_DJANGO, IS_REVERB]);

  // هندلر مشترک Packet‌ها (Django WS + Reverb Echo)
  const handlePacket = useCallback(
    (raw) => {
      console.log('[handlePacket] ENTER', raw);
      const t0 = performance.now?.() ?? Date.now();
      const packet = normPacket(raw);

      if (!packet || !packet.type) {
        console.warn('[handlePacket] Drop: invalid packet', raw);
        return;
      }

      console.log('[handlePacket] type=', packet.type, 'packet=', packet);

      switch (packet.type) {
        case 'message': {
          const m = packet.message;
          if (!m) {
            console.warn(
              '[handlePacket] message packet without message field',
              packet,
            );
            break;
          }

          const key = msgKey(m);
          const existed = seenMessageIdsRef.current.has(key);
          console.log('[handlePacket] message', { key, existed, m });

          if (!existed) {
            seenMessageIdsRef.current.add(key);
            setMessages((prev) => {
              const idx = prev.findIndex((x) => msgKey(x) === key);
              if (idx === -1) {
                console.log('[handlePacket] append message', {
                  id: m?.id,
                  room: m?.room_id,
                });
                return [...prev, m];
              }
              const next = prev.slice();
              next[idx] = { ...next[idx], ...m };
              console.log('[handlePacket] merge message', {
                key,
                idx,
                fields: Object.keys(m),
              });
              return next;
            });
          } else {
            console.log('[handlePacket] dedup skip', { key });
          }

          dispatch(updateMessages({ type: 'message', message: m }));

          const fromOther =
            m?.sender_id && currentUserId && m.sender_id !== currentUserId;
          const isSystem =
            String(m?.sender_name || '').toLowerCase() === 'system';

          if (fromOther) {
            try {
              sendJsonMessageRef.current?.({
                type: 'read_receipt_confirmation',
                message_id: m.id,
              });
              console.log('[handlePacket] sent read_receipt_confirmation', {
                id: m.id,
              });
            } catch (e) {
              console.error('[handlePacket] read_receipt send failed', e);
            }
          }

          if (fromOther && !isSystem) {
            try {
              show(m.sender_name || 'پیام جدید', m.content || '', {
                always: true,
              });
              bump();
              console.log('[handlePacket] notified + bumped title', {
                id: m.id,
              });
            } catch (e) {
              console.error('[handlePacket] notify failed', e);
            }
          }

          break;
        }

        case 'typing_indicator': {
          const uid = packet.user_id;
          if (!uid) {
            console.warn(
              '[handlePacket] typing_indicator without user_id',
              packet,
            );
            break;
          }
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setTyping(uid);
          console.log('[handlePacket] typing start', { uid });

          timeoutRef.current = setTimeout(() => {
            dispatch(resetTypingIndicator(uid));
            setTyping(null);
            console.log('[handlePacket] typing stop (timeout)', { uid });
          }, 5000);
          break;
        }

        case 'message_received': {
          const mid = coerceId(packet.message);
          console.log('[handlePacket] message_received', { id: mid });
          setMessages((prev) =>
            prev.map((x) =>
              coerceId(x.id) === mid ? { ...x, read_receipt: true } : x,
            ),
          );
          break;
        }

        case 'message_updated': {
          const m = packet.message;
          if (!m) {
            console.warn(
              '[handlePacket] message_updated without message',
              packet,
            );
            break;
          }
          const key = msgKey(m);
          console.log('[handlePacket] message_updated', { key, m });
          setMessages((prev) => {
            const idx = prev.findIndex((x) => msgKey(x) === key);
            if (idx === -1) {
              console.log('[handlePacket] update ignored (not found)', { key });
              return prev;
            }
            const next = prev.slice();
            next[idx] = { ...next[idx], ...m };
            return next;
          });
          break;
        }

        case 'message_deleted': {
          const mid = coerceId(packet.message);
          console.log('[handlePacket] message_deleted', { id: mid });
          setMessages((prev) => prev.filter((x) => coerceId(x.id) !== mid));
          break;
        }

        default: {
          console.warn(
            '[handlePacket] unknown packet type',
            packet.type,
            packet,
          );
          break;
        }
      }

      const t1 = performance.now?.() ?? Date.now();
      console.log('[handlePacket] EXIT, time(ms)=', Math.round(t1 - t0));
    },
    [dispatch, currentUserId, setMessages, show, bump],
  );

  // Echo (Reverb) برای تایپینگ و پیام‌ها
  const { emitTyping } = useTypingEcho({
    enabled: IS_REVERB,
    accessToken,
    roomId,
    onPacket: handlePacket,
    onTypingChange: (userIdOrNull) => {
      console.log('[useTypingEcho] onTypingChange', { userIdOrNull });
      setTyping(userIdOrNull);
    },
  });

  // Django WS
  const socketUrl = useMemo(() => {
    if (!IS_DJANGO || !roomId) return null;
    const url = buildWsUrlForDjango(roomId, accessToken);
    console.log('[ChatWindow] WS url computed', url);
    return url;
  }, [IS_DJANGO, roomId, accessToken]);

  const { sendJsonMessage, readyState } = useChatWebSocket(
    socketUrl,
    handlePacket,
  );
  useEffect(() => {
    sendJsonMessageRef.current = sendJsonMessage;
    console.log('[ChatWindow] sendJsonMessageRef set');
  }, [sendJsonMessage]);

  useEffect(() => {
    const status = IS_DJANGO
      ? readyState === 0
        ? 'Connecting...'
        : readyState === 1
        ? 'Connected'
        : readyState === 2
        ? 'Disconnecting...'
        : readyState === 3
        ? 'Disconnected'
        : '—'
      : 'Reverb/Echo connected';
    setConnectionStatus(status);
    console.log('[ChatWindow] WS status', { readyState, status, IS_DJANGO });
  }, [IS_DJANGO, readyState]);

  useEffect(() => {
    if (fetchError) {
      console.error('[ChatWindow] fetchError', fetchError);
      setError('Error fetching messages. Please try again.');
    }
  }, [fetchError]);

  const handleSendMessage = useCallback(
    async (e) => {
      e.preventDefault();
      const text = messageInput.trim();
      console.log('[handleSendMessage] submit', { text, IS_DJANGO });

      if (!text) {
        setError('Message cannot be empty');
        console.warn('[handleSendMessage] empty message');
        return;
      }

      if (IS_DJANGO) {
        if (readyState !== 1) {
          setError('WebSocket connection is not open.');
          console.warn('[handleSendMessage] WS not open', { readyState });
          return;
        }
        try {
          sendJsonMessageRef.current?.({ type: 'chat_message', content: text });
          console.log('[handleSendMessage] WS sent');
          setMessageInput('');
          setError(null);
        } catch (err) {
          console.error('[handleSendMessage] WS send error', err);
          setError(`Error sending message. Details: ${err.message}`);
        }
        return;
      }

      // Reverb (HTTP POST)
      try {
        const url = endpoints?.roomMessages
          ? endpoints.roomMessages(roomId)
          : null;
        if (!url) throw new Error('roomMessages endpoint is missing');

        console.log('[handleSendMessage] HTTP POST', { url, text });

        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ content: text }),
        });

        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({}));
          console.error('[handleSendMessage] HTTP error', resp.status, errBody);
          throw new Error(errBody?.error || `POST message ${resp.status}`);
        }

        const saved = await resp.json().catch(() => ({}));
        console.log('[handleSendMessage] HTTP saved', saved);

        setMessages((prev) => [
          ...prev,
          saved?.id
            ? saved
            : {
                id: Date.now(),
                content: text,
                sender_id: currentUserId || null,
                created_at: new Date().toISOString(),
                read_receipt: false,
              },
        ]);

        setMessageInput('');
        setError(null);
      } catch (err) {
        console.error('[handleSendMessage] HTTP send error', err);
        setError(err.message || 'Failed to send message');
      }
    },
    [
      IS_DJANGO,
      messageInput,
      readyState,
      endpoints,
      roomId,
      accessToken,
      currentUserId,
      setMessages,
    ],
  );

  const handleInputChange = useCallback(
    (e) => {
      const val = e.target.value;
      setMessageInput(val);
      console.log('[handleInputChange]', {
        val,
        IS_DJANGO,
        IS_REVERB,
        currentUserId,
      });

      if (val.trim() === '' || !currentUserId) return;
      if (IS_DJANGO) {
        console.log('[handleInputChange] send typing_indicator via WS');
        sendJsonMessageRef.current?.({
          type: 'typing_indicator',
          sender_id: currentUserId,
        });
      } else if (IS_REVERB) {
        console.log('[handleInputChange] emitTyping via Reverb');
        emitTyping(currentUserId);
      }
    },
    [currentUserId, IS_DJANGO, IS_REVERB, emitTyping],
  );

  if (!roomId)
    return (
      <div className="no-chat-selected">Select a chat to start messaging</div>
    );

  return (
    <div className="chat-window">
      {loading && (
        <div className="loading-spinner">
          <Spinner animation="border" />
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="connection-status">{connectionStatus}</div>

      <MessageList messages={messages} currentUserId={currentUserId} />
      <TypingIndicator typing={typing} />

      <Form onSubmit={handleSendMessage} className="chat-input-form">
        <Form.Group controlId="messageInput">
          <Form.Control
            type="text"
            placeholder="Type a message..."
            value={messageInput}
            onChange={handleInputChange}
          />
        </Form.Group>
        <Button type="submit" variant="primary">
          Send
        </Button>
      </Form>
    </div>
  );
};

export default ChatWindow;

