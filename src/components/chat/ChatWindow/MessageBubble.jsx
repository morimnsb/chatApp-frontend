import React, { useMemo, useEffect } from 'react';
import { formatTime } from '@/utils/formatTime';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';

const coerceId = (v) => (v == null ? null : Number(v) || String(v));

function normalizeMessage(m) {
  const roomId = coerceId(m?.room_id ?? m?.chat_room_id ?? m?.roomId ?? m?.chatRoomId);
  const senderId = coerceId(
    m?.sender_id ??
      m?.user_id ??
      m?.sender?.id ??
      m?.user?.id ??
      m?.senderId ??
      m?.userId
  );

  const senderName =
    m?.sender_name ??
    m?.sender?.name ??
    m?.user?.name ??
    m?.sender_first_name ??
    m?.user?.first_name ??
    '';

  const content = (m?.content ?? m?.message ?? m?.text ?? '').toString();
  const created =
    m?.created_at ??
    m?.createdAt ??
    m?.timestamp ??
    m?.sent_at ??
    m?.updated_at ??
    null;

  const read = Boolean(m?.read_receipt ?? m?.read ?? m?.is_read);

  return { roomId, senderId, senderName, content, created, read };
}

export default React.memo(function MessageBubble({ message, currentUserId, index }) {
  const n = useMemo(() => normalizeMessage(message), [message]);

  const mine =
    n.senderId != null &&
    currentUserId != null &&
    String(n.senderId) === String(currentUserId);

  // اگر content خالیه، اینجا دیباگ می‌کنیم ولی null نکن!
  useEffect(() => {
    if (!DEBUG) return;
    // eslint-disable-next-line no-console
    console.log('[MessageBubble] render', {
      index,
      id: message?.id,
      roomId: n.roomId,
      senderId: n.senderId,
      currentUserId,
      mine,
      contentLen: n.content?.length ?? 0,
      keys: Object.keys(message || {}).slice(0, 14),
    });
  }, [DEBUG, index, message, n.roomId, n.senderId, n.content, currentUserId, mine]);

  return (
    <div className={`message-bubble ${mine ? 'mine' : 'theirs'}`} role="listitem">
      {/* header کوچک (اختیاری) */}
      <div className="chat-header-details">
        <div className="chat-header-info">
          <h4>{mine ? 'You' : (n.senderName || `User #${n.senderId ?? '?'}`)}</h4>
        </div>
      </div>

      <div className="message-text">
        {n.content || <span style={{ opacity: 0.6 }}>(empty message)</span>}

        <span className="message-time">
          {n.created ? formatTime(n.created) : ''}
        </span>

        {/* read receipt فقط برای پیام‌های خودت */}
        {mine && (
          <span className={`read_receipt ${n.read ? 'read' : ''}`}>
            {n.read ? '✓✓' : '✓'}
          </span>
        )}
      </div>
    </div>
  );
});
