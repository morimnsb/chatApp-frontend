import React, { useEffect, useMemo, useRef } from 'react';
import MessageBubble from '@/MessageBubble';

const coerceId = (v) => (v == null ? null : Number(v) || String(v));

const getKey = (m, idx) => {
  // اولویت: server id + room_id
  if (m?.id != null) return `id:${coerceId(m.id)}|room:${coerceId(m.room_id)}`;
  // fallback: timestamp + sender + idx
  const t = m?.created_at || m?.timestamp || m?.updated_at || 'na';
  return `tmp:${t}|from:${coerceId(m?.sender_id)}|idx:${idx}`;
};

// برای مرتب‌سازی مقاوم
const getTime = (m) =>
  Date.parse(m?.timestamp || m?.created_at || m?.updated_at || 0) || 0;

function isNearBottom(el, thresholdPx = 120) {
  if (!el) return true;
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
  return distance < thresholdPx;
}

const MessageList = React.memo(function MessageList({
  messages,
  currentUserId,
  autoScroll = true, // می‌تونی خاموشش کنی
}) {
  const wrapRef = useRef(null);
  const stickToBottomRef = useRef(true);

  const safeMessages = useMemo(() => {
    const arr = Array.isArray(messages) ? messages.slice() : [];

    // ✅ مرتب‌سازی فقط وقتی لازم باشه
    arr.sort((a, b) => getTime(a) - getTime(b));

    // ✅ dedup سبک (اگر پیام تکراری بیاد)
    const seen = new Set();
    const out = [];
    for (const m of arr) {
      const k = `${coerceId(m?.id)}|${coerceId(m?.room_id)}|${getTime(m)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(m);
    }

    return out;
  }, [messages]);

  // track user scroll intent
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const onScroll = () => {
      stickToBottomRef.current = isNearBottom(el);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // ✅ auto scroll to bottom only if user is near bottom
  useEffect(() => {
    if (!autoScroll) return;
    const el = wrapRef.current;
    if (!el) return;

    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [safeMessages.length, autoScroll]);

  return (
    <div className="messages" role="list" ref={wrapRef}>
      {safeMessages.length ? (
        safeMessages.map((m, idx) => (
          <MessageBubble key={getKey(m, idx)} message={m} currentUserId={currentUserId} />
        ))
      ) : (
        <div className="no-messages">No messages yet</div>
      )}
    </div>
  );
});

export default MessageList;
