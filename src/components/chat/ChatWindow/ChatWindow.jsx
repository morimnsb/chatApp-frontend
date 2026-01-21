// src/components/ChatWindow.jsx
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import { useDispatch } from 'react-redux';

import { updateMessages, resetTypingIndicator } from '@/actions/messageActions';

import { buildWsUrlForDjango } from '@/utils/wsUrl';
import useChatWebSocket from '@/hooks/useChatWebSocket';
import useRoomMessages from '@/hooks/useRoomMessages';
import useDesktopNotify from '@/hooks/useDesktopNotify';
import useTitleBadge from '@/hooks/useTitleBadge';
import useTypingEcho from '@/hooks/useTypingEcho';

import MessageList from '@/MessageList';
import TypingIndicator from '@/TypingIndicator';

// ---------- helpers ----------
const coerceId = (v) => (v == null ? null : Number(v) || String(v));
const normPacket = (packet) => {
  if (!packet) return null;
  if (packet.type === 'message' && !packet.message && packet.data) {
    return { ...packet, message: packet.data };
  }
  return packet;
};
const msgKey = (m) => `${coerceId(m?.id)}|${coerceId(m?.room_id)}`;

// throttle ساده برای typing (هر 700ms یکبار)
function useThrottleMs(ms = 700) {
  const lastRef = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now - lastRef.current < ms) return false;
    lastRef.current = now;
    return true;
  }, [ms]);
}

export default function ChatWindow({
  roomId,
  endpoints,
  effectiveKind,
  accessToken,     // ✅ از بیرون
  currentUserId,   // ✅ از بیرون
}) {
  const dispatch = useDispatch();

  const kind = String(effectiveKind || '').toLowerCase();
  const IS_DJANGO = kind === 'django';
  const IS_REVERB = kind === 'reverb';

  const [messageInput, setMessageInput] = useState('');
  const [uiError, setUiError] = useState(null);
  const [typingUserId, setTypingUserId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('—');

  const sendJsonMessageRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // dedup per-room (وقتی roomId عوض شود پاک می‌کنیم)
  const seenRef = useRef(new Set());
  useEffect(() => {
    seenRef.current = new Set();
  }, [roomId]);

  const { messages, setMessages, loading, fetchError } = useRoomMessages(
    roomId,
    endpoints,
    accessToken
  );

  const { show } = useDesktopNotify();
  const { bump } = useTitleBadge();

  // ---------- Packet handler ----------
  const handlePacket = useCallback(
    (raw) => {
      const packet = normPacket(raw);
      if (!packet?.type) return;

      switch (packet.type) {
        case 'message': {
          const m = packet.message;
          if (!m) return;

          const key = msgKey(m);
          if (!seenRef.current.has(key)) {
            seenRef.current.add(key);
            setMessages((prev) => {
              const idx = prev.findIndex((x) => msgKey(x) === key);
              if (idx === -1) return [...prev, m];
              const next = prev.slice();
              next[idx] = { ...next[idx], ...m };
              return next;
            });
          }

          // redux global store update (اگر لازم داری)
          dispatch(updateMessages({ type: 'message', message: m }));

          const fromOther =
            m?.sender_id && currentUserId && m.sender_id !== currentUserId;
          const isSystem =
            String(m?.sender_name || '').toLowerCase() === 'system';

          // read receipt (فقط در django ws)
          if (fromOther && IS_DJANGO) {
            try {
              sendJsonMessageRef.current?.({
                type: 'read_receipt_confirmation',
                message_id: m.id,
              });
            } catch {}
          }

          if (fromOther && !isSystem) {
            try {
              show(m.sender_name || 'پیام جدید', m.content || '', { always: true });
              bump();
            } catch {}
          }
          break;
        }

        case 'typing_indicator': {
          const uid = packet.user_id;
          if (!uid) return;

          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          setTypingUserId(uid);

          typingTimeoutRef.current = setTimeout(() => {
            dispatch(resetTypingIndicator(uid));
            setTypingUserId(null);
          }, 3500);
          break;
        }

        case 'message_received': {
          const mid = coerceId(packet.message);
          setMessages((prev) =>
            prev.map((x) => (coerceId(x.id) === mid ? { ...x, read_receipt: true } : x))
          );
          break;
        }

        case 'message_updated': {
          const m = packet.message;
          if (!m) return;
          const key = msgKey(m);
          setMessages((prev) => {
            const idx = prev.findIndex((x) => msgKey(x) === key);
            if (idx === -1) return prev;
            const next = prev.slice();
            next[idx] = { ...next[idx], ...m };
            return next;
          });
          break;
        }

        case 'message_deleted': {
          const mid = coerceId(packet.message);
          setMessages((prev) => prev.filter((x) => coerceId(x.id) !== mid));
          break;
        }

        default:
          break;
      }
    },
    [dispatch, currentUserId, IS_DJANGO, setMessages, show, bump]
  );

  // ---------- Reverb typing/messages ----------
  const { emitTyping } = useTypingEcho({
    enabled: IS_REVERB && Boolean(accessToken) && Boolean(roomId),
    accessToken,
    roomId,
    onPacket: handlePacket,
    onTypingChange: (uidOrNull) => setTypingUserId(uidOrNull),
  });

  // ---------- Django WS ----------
  const socketUrl = useMemo(() => {
    if (!IS_DJANGO || !roomId || !accessToken) return null;
    return buildWsUrlForDjango(roomId, accessToken);
  }, [IS_DJANGO, roomId, accessToken]);

  const { sendJsonMessage, readyState } = useChatWebSocket(socketUrl, handlePacket);

  useEffect(() => {
    sendJsonMessageRef.current = sendJsonMessage;
  }, [sendJsonMessage]);

  useEffect(() => {
    if (IS_DJANGO) {
      const status =
        readyState === 0 ? 'Connecting…' :
        readyState === 1 ? 'Connected' :
        readyState === 2 ? 'Disconnecting…' :
        readyState === 3 ? 'Disconnected' : '—';
      setConnectionStatus(status);
    } else if (IS_REVERB) {
      setConnectionStatus('Reverb/Echo');
    } else {
      setConnectionStatus('—');
    }
  }, [IS_DJANGO, IS_REVERB, readyState]);

  useEffect(() => {
    if (fetchError) setUiError('Error fetching messages. Please try again.');
  }, [fetchError]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // ---------- send message (Optimistic UI) ----------
  const handleSendMessage = useCallback(
    async (e) => {
      e.preventDefault();
      const text = messageInput.trim();
      if (!text) {
        setUiError('Message cannot be empty');
        return;
      }
      if (!accessToken) {
        setUiError('Missing access token');
        return;
      }

      setUiError(null);

      // optimistic message
      const tempId = `tmp-${Date.now()}`;
      const optimistic = {
        id: tempId,
        room_id: roomId,
        content: text,
        sender_id: currentUserId || null,
        created_at: new Date().toISOString(),
        read_receipt: false,
        _optimistic: true,
      };

      setMessages((prev) => [...prev, optimistic]);
      setMessageInput('');

      // Django: WS
      if (IS_DJANGO) {
        if (readyState !== 1) {
          setUiError('WebSocket connection is not open.');
          return;
        }
        try {
          sendJsonMessageRef.current?.({ type: 'chat_message', content: text });
          return;
        } catch (err) {
          setUiError(err?.message || 'WS send failed');
          return;
        }
      }

      // Reverb: HTTP POST
      try {
        const url = endpoints?.roomMessages ? endpoints.roomMessages(roomId) : null;
        if (!url) throw new Error('roomMessages endpoint is missing');

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
          throw new Error(errBody?.error || `POST message ${resp.status}`);
        }

        const saved = await resp.json().catch(() => ({}));

        // replace optimistic with server message (اگر برگشت)
        if (saved?.id) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...saved, _optimistic: false } : m))
          );
        } else {
          // اگر سرور چیزی نداد، فقط optimistic را غیر-optimistic کن
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, _optimistic: false } : m))
          );
        }
      } catch (err) {
        // mark as failed (می‌تونی دکمه retry هم اضافه کنی)
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, _failed: true } : m))
        );
        setUiError(err?.message || 'Failed to send message');
      }
    },
    [
      IS_DJANGO,
      messageInput,
      roomId,
      endpoints,
      accessToken,
      currentUserId,
      readyState,
      setMessages,
    ]
  );

  // ---------- typing (throttled) ----------
  const canEmitTyping = useThrottleMs(700);

  const handleInputChange = useCallback(
    (e) => {
      const val = e.target.value;
      setMessageInput(val);

      if (!currentUserId) return;
      if (!val.trim()) return;
      if (!canEmitTyping()) return;

      if (IS_DJANGO) {
        sendJsonMessageRef.current?.({
          type: 'typing_indicator',
          sender_id: currentUserId,
        });
      } else if (IS_REVERB) {
        emitTyping(currentUserId);
      }
    },
    [currentUserId, IS_DJANGO, IS_REVERB, emitTyping, canEmitTyping]
  );

  if (!roomId) {
    return <div className="no-chat-selected">Select a chat to start messaging</div>;
  }

  return (
    <div className="chat-window">
      {loading && (
        <div className="loading-spinner">
          <Spinner animation="border" />
        </div>
      )}

      {uiError && <Alert variant="danger">{uiError}</Alert>}

      <div className="connection-status">{connectionStatus}</div>

      <MessageList messages={messages} currentUserId={currentUserId} />
      <TypingIndicator typing={typingUserId} />

      <Form onSubmit={handleSendMessage} className="chat-input-form">
        <Form.Group controlId="messageInput">
          <Form.Control
            type="text"
            placeholder="Type a message..."
            value={messageInput}
            onChange={handleInputChange}
            autoComplete="off"
          />
        </Form.Group>

        <Button type="submit" variant="primary" disabled={!messageInput.trim()}>
          Send
        </Button>
      </Form>
    </div>
  );
}
