// src/features/chat/components/TypingIndicator.tsx
import React from "react";

type Id = string | number;

type Props = {
  typing?: boolean | Id | null;
  text?: string;
};

export default function TypingIndicator({ typing, text }: Props) {
  const isTyping = Boolean(typing);
  if (!isTyping) return null;
  return <div className="typing-indicator">{text ?? "User is typing..."}</div>;
}