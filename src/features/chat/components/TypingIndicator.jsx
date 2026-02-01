import React from 'react';

export default function TypingIndicator({ typing }) {
  if (!typing) return null;
  return <div className="typing-indicator">User is typing...</div>;
}
