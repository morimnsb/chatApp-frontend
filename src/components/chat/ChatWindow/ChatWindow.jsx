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

import ChatMessagesList from '@/ChatMessagesList';
import TypingIndicator from '@/TypingIndicator';

// ---------- debug flags ----------
const DEV = import.meta.env.DEV === true;
const DEBUG_CHAT = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';

// ---------- helpers ----------
const coerceId = (v) => (v == null ? null : Number(v) || String(v));

const normPacket = (packet) => {
  if (!packet) return null;
  if (packet.type === 'message' && !packet.message && packet.data) {
    return { ...packet, message: packet.data };
  }
  return packet;
};

// ✅ key: handle both room_id and chat_room_id
const getRoomIdFromMsg = (m) =>
  coerceId(m?.room_id ?? m?.chat_room_id ?? m?.roomId ?? m?.room?.id ?? null);

const msgKey = (m) => {
  const mid = coerceId(m?.id);
  const rid = getRoomIdFromMsg(m);
  return `${mid}|${rid}`;
};

const getSenderIdFromMsg = (m) =>
  coerceId(m?.sender_id ?? m?.user_id ?? m?.sender?.id ?? m?.user?.id ?? null);

const previewMsg = (m) => {
  if (!m) return null;
  return {
    id: coerceId(m.id),
    room: getRoomIdFromMsg(m),
    sender: getSenderIdFromMsg(m),
    content: String(m?.content ?? '').slice(0, 60),
    created_at: m?.created_at ?? m?.createdAt ?? null,
    keys: Object.keys(m || {}).slice(0, 12),
  };
};

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
      const messagesRef = useRef(null);

  // ✅ debug trace refs
  const traceRef = useRef({
    roomId: null,
    lastLen: 0,
    lastKey: null,
    lastPktType: null,
    lastPktAt: 0,
    lastMsgPreview: null,
    dedupHits: 0,
    added: 0,
    updated: 0,
    droppedWrongRoom: 0,
  });

  // dedup per-room (وقتی roomId عوض شود پاک می‌کنیم)
  const seenRef = useRef(new Set());
  useEffect(() => {
    seenRef.current = new Set();
    traceRef.current = {
      ...traceRef.current,
      roomId,
      lastLen: 0,
      lastKey: null,
      lastPktType: null,
      lastPktAt: Date.now(),
      lastMsgPreview: null,
      dedupHits: 0,
      added: 0,
      updated: 0,
      droppedWrongRoom: 0,
    };

    if (DEBUG_CHAT) {
      console.log('[ChatWindow] room changed -> reset dedup/trace', { roomId });
    }
  }, [roomId]);

  const { messages, setMessages, loading, fetchError } = useRoomMessages(
    roomId,
    endpoints,
    accessToken
  );

  const { show } = useDesktopNotify();
  const { bump } = useTitleBadge();

  // ✅ log messages changes (track new received)
  useEffect(() => {
    if (!DEBUG_CHAT) return;

    const t = traceRef.current;
    const len = Array.isArray(messages) ? messages.length : 0;
    const last = len ? messages[len - 1] : null;

    // فقط وقتی len یا lastKey تغییر کرد لاگ کنیم
    const lk = last ? msgKey(last) : null;
    if (len !== t.lastLen || lk !== t.lastKey) {
      t.lastLen = len;
      t.lastKey = lk;
      t.lastMsgPreview = previewMsg(last);

      console.log('[ChatWindow] messages changed', {
        roomId,
        len,
        lastKey: lk,
        lastMsg: t.lastMsgPreview,
        stats: {
          added: t.added,
          updated: t.updated,
          dedupHits: t.dedupHits,
          droppedWrongRoom: t.droppedWrongRoom,
        },
      });
    }
  }, [messages, roomId]);

  // ---------- Packet handler ----------
  const handlePacket = useCallback(
    (raw) => {
      const packet = normPacket(raw);
      if (!packet?.type) return;

      const t = traceRef.current;
      t.lastPktType = packet.type;
      t.lastPktAt = Date.now();

      if (DEBUG_CHAT) {
        console.log('[ChatWindow] packet', {
          roomId,
          type: packet.type,
          keys: Object.keys(packet || {}),
          rawPreview: JSON.stringify(packet).slice(0, 180),
        });
      }

      switch (packet.type) {
        case 'message': {
          const m = packet.message;
          if (!m) {
            if (DEBUG_CHAT) console.warn('[ChatWindow] message packet without message field', packet);
            return;
          }

          const incomingRoomId = getRoomIdFromMsg(m);
          const activeRoomId = coerceId(roomId);

          // ✅ اگر پیام برای روم دیگری است، drop کن (یا اگر می‌خوای global نگه داری، این شرط رو بردار)
          if (activeRoomId != null && incomingRoomId != null && String(incomingRoomId) !== String(activeRoomId)) {
            t.droppedWrongRoom += 1;
            if (DEBUG_CHAT) {
              console.warn('[ChatWindow] DROP message for other room', {
                activeRoomId,
                incomingRoomId,
                msg: previewMsg(m),
              });
            }

            // ولی هنوز می‌تونی redux global رو آپدیت کنی
            dispatch(updateMessages({ type: 'message', message: m }));
            return;
          }

          const key = msgKey(m);

          // ✅ dedup + merge
          if (!seenRef.current.has(key)) {
            seenRef.current.add(key);
            t.added += 1;

            if (DEBUG_CHAT) {
              console.log('[ChatWindow] ADD message', {
                key,
                msg: previewMsg(m),
              });
            }

            setMessages((prev) => {
              const arr = Array.isArray(prev) ? prev : [];
              const idx = arr.findIndex((x) => msgKey(x) === key);
              if (idx === -1) return [...arr, m];

              // اگر پیدا شد، merge کن
              const next = arr.slice();
              next[idx] = { ...next[idx], ...m };
              t.updated += 1;
              return next;
            });
          } else {
            t.dedupHits += 1;
            if (DEBUG_CHAT) {
              console.log('[ChatWindow] DEDUP hit', { key, msg: previewMsg(m) });
            }
          }

          // redux global store update (اگر لازم داری)
          dispatch(updateMessages({ type: 'message', message: m }));

          const senderId = getSenderIdFromMsg(m);
          const meId = coerceId(currentUserId);

          const fromOther = senderId != null && meId != null && String(senderId) !== String(meId);
          const isSystem = String(m?.sender_name || m?.user?.name || '').toLowerCase() === 'system';

          // read receipt (فقط در django ws)
          if (fromOther && IS_DJANGO) {
            try {
              sendJsonMessageRef.current?.({
                type: 'read_receipt_confirmation',
                message_id: m.id,
              });
              if (DEBUG_CHAT) console.log('[ChatWindow] sent read_receipt_confirmation', { message_id: m.id });
            } catch (e) {
              if (DEBUG_CHAT) console.warn('[ChatWindow] read_receipt_confirmation failed', e);
            }
          }

          if (fromOther && !isSystem) {
            try {
              show(m.sender_name || m?.user?.name || 'پیام جدید', m.content || '', { always: true });
              bump();
              if (DEBUG_CHAT) console.log('[ChatWindow] notify+bump', { fromOther, senderId, meId });
            } catch (e) {
              if (DEBUG_CHAT) console.warn('[ChatWindow] notify failed', e);
            }
          }
          break;
        }

        case 'typing_indicator': {
          const uid = packet.user_id;
          if (!uid) return;

          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          setTypingUserId(uid);

          if (DEBUG_CHAT) console.log('[ChatWindow] typing_indicator', { uid });

          typingTimeoutRef.current = setTimeout(() => {
            dispatch(resetTypingIndicator(uid));
            setTypingUserId(null);
            if (DEBUG_CHAT) console.log('[ChatWindow] typing cleared', { uid });
          }, 3500);
          break;
        }

        case 'message_received': {
          const mid = coerceId(packet.message);
          if (DEBUG_CHAT) console.log('[ChatWindow] message_received', { mid });

          setMessages((prev) => {
            const arr = Array.isArray(prev) ? prev : [];
            return arr.map((x) => (coerceId(x.id) === mid ? { ...x, read_receipt: true } : x));
          });
          break;
        }

        case 'message_updated': {
          const m = packet.message;
          if (!m) return;

          const key = msgKey(m);
          if (DEBUG_CHAT) console.log('[ChatWindow] message_updated', { key, msg: previewMsg(m) });

          setMessages((prev) => {
            const arr = Array.isArray(prev) ? prev : [];
            const idx = arr.findIndex((x) => msgKey(x) === key);
            if (idx === -1) return arr;
            const next = arr.slice();
            next[idx] = { ...next[idx], ...m };
            traceRef.current.updated += 1;
            return next;
          });
          break;
        }

        case 'message_deleted': {
          const mid = coerceId(packet.message);
          if (DEBUG_CHAT) console.log('[ChatWindow] message_deleted', { mid });

          setMessages((prev) => {
            const arr = Array.isArray(prev) ? prev : [];
            return arr.filter((x) => coerceId(x.id) !== mid);
          });
          break;
        }

        default:
          if (DEBUG_CHAT) console.log('[ChatWindow] unhandled packet type', packet.type);
          break;
      }
    },
    [dispatch, currentUserId, IS_DJANGO, setMessages, show, bump, roomId]
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

      if (DEBUG_CHAT) {
        console.log('[ChatWindow] SEND optimistic', { roomId, optimistic: previewMsg(optimistic) });
      }

      setMessages((prev) => {
        const arr = Array.isArray(prev) ? prev : [];
        return [...arr, optimistic];
      });
      setMessageInput('');

      // Django: WS
      if (IS_DJANGO) {
        if (readyState !== 1) {
          setUiError('WebSocket connection is not open.');
          return;
        }
        try {
          sendJsonMessageRef.current?.({ type: 'chat_message', content: text });
          if (DEBUG_CHAT) console.log('[ChatWindow] WS send ok');
          return;
        } catch (err) {
          setUiError(err?.message || 'WS send failed');
          if (DEBUG_CHAT) console.warn('[ChatWindow] WS send failed', err);
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
        if (DEBUG_CHAT) console.log('[ChatWindow] POST saved', saved);

        if (saved?.id) {
          setMessages((prev) => {
            const arr = Array.isArray(prev) ? prev : [];
            return arr.map((m) => (m.id === tempId ? { ...saved, _optimistic: false } : m));
          });
        } else {
          setMessages((prev) => {
            const arr = Array.isArray(prev) ? prev : [];
            return arr.map((m) => (m.id === tempId ? { ...m, _optimistic: false } : m));
          });
        }
      } catch (err) {
        setMessages((prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          return arr.map((m) => (m.id === tempId ? { ...m, _failed: true } : m));
        });
        setUiError(err?.message || 'Failed to send message');
        if (DEBUG_CHAT) console.warn('[ChatWindow] POST send failed', err);
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
        if (DEBUG_CHAT) console.log('[ChatWindow] typing emit (django)', { currentUserId });
      } else if (IS_REVERB) {
        emitTyping(currentUserId);
        if (DEBUG_CHAT) console.log('[ChatWindow] typing emit (reverb)', { currentUserId });
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

      {/* ✅ optional overlay debug */}
      {DEBUG_CHAT && (
        <div style={{ padding: '6px 10px', fontSize: 12, opacity: 0.85, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div>roomId: {String(roomId)} | kind: {kind}</div>
          <div>
            msgs: {Array.isArray(messages) ? messages.length : 0} | me: {String(currentUserId ?? 'null')}
          </div>
        </div>
      )}


<ChatMessagesList
  messages={messages}
  currentUserId={currentUserId}
  containerRef={messagesRef}
/>

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
