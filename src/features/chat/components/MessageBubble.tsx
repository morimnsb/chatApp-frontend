// chatApp-frontend\src\features\chat\components\MessageBubble.tsx
import React, { useMemo } from "react";
import { formatTime } from "@/shared/utils/formatTime";

type Id = number | string;

export type MessageLike = Record<string, any>;

type NormalizedMessage = {
  roomId: Id | null;
  senderId: Id | null;
  senderName: string;
  content: string;
  created: string | number | null;
  read: boolean;
};

type Props = {
  message: MessageLike;
  currentUserId?: Id | null;
  index?: number;
};

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || "") === "true";

const coerceId = (v: unknown): Id | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n;
};

function normalizeMessage(m: MessageLike): NormalizedMessage {
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
    "";

  const content = (m?.content ?? m?.message ?? m?.text ?? "").toString();

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

function MessageBubble({ message, currentUserId, index }: Props) {
  const n = useMemo(() => normalizeMessage(message), [message]);

  const mine =
    n.senderId != null &&
    currentUserId != null &&
    String(n.senderId) === String(currentUserId);

  // (debug block optional)
  // if (DEBUG) console.log("[MessageBubble]", { index, mine, n });

  return (
    <div className={`message-bubble ${mine ? "mine" : "theirs"}`} role="listitem">
      <div className="chat-header-details">
        <div className="chat-header-info">
          <h4>{mine ? "You" : n.senderName || `User #${n.senderId ?? "?"}`}</h4>
        </div>
      </div>

      <div className="message-text">
        {n.content || <span style={{ opacity: 0.6 }}>(empty message)</span>}

        <span className="message-time">{n.created ? formatTime(n.created) : ""}</span>

        {mine && (
          <span className={`read_receipt ${n.read ? "read" : ""}`}>
            {n.read ? "✓✓" : "✓"}
          </span>
        )}
      </div>
    </div>
  );
}

export default React.memo(MessageBubble);