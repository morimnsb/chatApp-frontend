import React from 'react';
// typing indicator (تایپینگ: «تای-پینگ»)
const TypingIndicator = ({ typing }) =>
  typing ? <div className="typing-indicator">User is typing...</div> : null;

export default TypingIndicator;
