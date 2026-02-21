// chatApp-frontend\src\features\chat\components\ChatMessagesList.tsx
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import MessageBubble from "./MessageBubble";

type Id = string | number;

export type ChatMessage = {
  id?: Id | null;
  client_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  read_receipt?: any;
  content?: string | null;
  [k: string]: any;
};

type Props = {
  messages?: ChatMessage[] | null;
  currentUserId?: Id | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  initial?: number;
  step?: number;
};

const safeArray = (v: Props["messages"]): ChatMessage[] =>
  Array.isArray(v) ? v : [];

const getKey = (m: ChatMessage, idx: number): string => {
  if (m?.id != null) return `id:${String(m.id)}`;
  if (m?.client_id) return `cid:${m.client_id}`;
  return `f:${m?.created_at || "na"}:${idx}`;
};

export default React.memo(function ChatMessagesList({
  messages,
  currentUserId,
  containerRef,
  initial = 30,
  step = 30,
}: Props) {
  const list = safeArray(messages);

  const [visibleCount, setVisibleCount] = useState<number>(initial);

  useEffect(() => {
    setVisibleCount(initial);
  }, [initial]);

  // ✅ اگر آخرین پیام تغییر کند (بدون تغییر length)، با این key UI آپدیت می‌شود
  const snapshotKey = useMemo(() => {
    const last = list[list.length - 1];
    if (!last) return "empty";
    return [
      String(last.id ?? last.client_id ?? "noid"),
      String(last.updated_at ?? ""),
      String(last.read_receipt ?? ""),
      String(last.content ?? "").slice(0, 30),
    ].join("|");
  }, [list]);

  const visible = useMemo(() => {
    return list.slice(Math.max(0, list.length - visibleCount));
    // snapshotKey را در deps می‌گذاریم تا وقتی آخرین پیام آپدیت شد هم visible دوباره محاسبه شود
  }, [list.length, visibleCount, snapshotKey]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef<boolean>(true);

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

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [containerRef, list.length, step]);

  useLayoutEffect(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;

    if (stickToBottomRef.current) {
      requestAnimationFrame(() => {
        bottom.scrollIntoView({ block: "end", behavior: "auto" });
      });
    }
  }, [visible.length, snapshotKey]);

  useEffect(() => {
    const last = list.length ? list[list.length - 1] : undefined;
    console.log("[ChatMessagesList] snapshot", {
      len: list.length,
      visibleLen: visible.length,
      currentUserId,
      lastId: last?.id ?? null,
      lastReceipt: (last as any)?.read_receipt ?? null,
      lastCreatedAt: last?.created_at ?? null,
    });
  }, [list.length, visible.length, currentUserId, snapshotKey]);

  return (
    // ✅ نکته: containerRef از بیرون می‌آید، همینجا باید به div وصل شود
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