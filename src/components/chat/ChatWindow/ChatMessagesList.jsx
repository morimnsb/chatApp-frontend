// src/components/ChatMessagesList.jsx
import React, { useEffect, useMemo } from 'react';
import MessageBubble from './MessageBubble';

const safeArray = (v) => (Array.isArray(v) ? v : []);

export default React.memo(function ChatMessagesList({
  messages,
  currentUserId,
  containerRef,
}) {
  const list = safeArray(messages);

  // ✅ stable debug snapshot
  useEffect(() => {
    console.log('[ChatMessagesList] snapshot', {
      len: list.length,
      currentUserId,
      lastId: list.at(-1)?.id ?? null,
      lastCreatedAt: list.at(-1)?.created_at ?? null,
    });
  }, [list.length, currentUserId]);

  // ✅ auto-scroll to bottom on new message
  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;
    // فقط وقتی پیام جدید اضافه میشه
    el.scrollTop = el.scrollHeight;
  }, [list.length, containerRef]);

  return (
    
    <div className="messages" ref={containerRef}>
      {list.length ? (
        list.map((m, index) => (
          <MessageBubble
            key={m?.id ?? `${m?.created_at}-${m?.content}-${index}`}
            message={m}
            currentUserId={currentUserId}
            index={index}
          />
        ))
        
      ) : (
        <div className="no-messages">No messages yet</div>
      )}
    </div>
  );
});
