// src/components/ChatMessagesList.jsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';

const safeArray = (v) => (Array.isArray(v) ? v : []);

const getKey = (m, idx) => {
  if (m?.id != null) return `id:${m.id}`;
  if (m?.client_id) return `cid:${m.client_id}`;
  return `f:${m?.created_at || 'na'}:${idx}`;
};

export default React.memo(function ChatMessagesList({
  messages,
  currentUserId,
  containerRef,
  initial = 30,
  step = 30,
}) {
  const list = safeArray(messages);

  const [visibleCount, setVisibleCount] = useState(initial);

  useEffect(() => {
    setVisibleCount(initial);
  }, [initial]);

  // ✅ اگر آخرین پیام تغییر کند (بدون تغییر length)، با این key UI آپدیت می‌شود
  const snapshotKey = useMemo(() => {
    const last = list[list.length - 1];
    if (!last) return 'empty';
    return [
      String(last.id ?? last.client_id ?? 'noid'),
      String(last.updated_at ?? ''),
      String(last.read_receipt ?? ''),
      String(last.content ?? '').slice(0, 30),
    ].join('|');
  }, [list]);

  const visible = useMemo(() => {
    return list.slice(Math.max(0, list.length - visibleCount));
  }, [list.length, visibleCount, snapshotKey]);

  const bottomRef = useRef(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;

    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = dist < 80;

      if (el.scrollTop < 40) {
        setVisibleCount((c) => Math.min(list.length, c + step));
      }
    };

    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [containerRef, list.length, step]);

  useLayoutEffect(() => {
    if (!bottomRef.current) return;

    if (stickToBottomRef.current) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
      });
    }
  }, [visible.length, snapshotKey]);

  useEffect(() => {
    const last = list.at(-1);
    console.log('[ChatMessagesList] snapshot', {
      len: list.length,
      visibleLen: visible.length,
      currentUserId,
      lastId: last?.id ?? null,
      lastReceipt: last?.read_receipt ?? null,
      lastCreatedAt: last?.created_at ?? null,
    });
  }, [list.length, visible.length, currentUserId, snapshotKey]);

  return (
    <div className="messages messages--limited" ref={containerRef}>
      {visible.length ? (
        visible.map((m, index) => (
          <MessageBubble
            key={getKey(m, index)}
            message={m}
            currentUserId={currentUserId}
            index={index}
          />
        ))
      ) : (
        <div className="no-messages">No messages yet</div>
      )}
      <div ref={bottomRef} />
    </div>
  );
});
