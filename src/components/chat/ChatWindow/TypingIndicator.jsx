// TypingIndicator.jsx
import React from 'react';

const TypingIndicator = ({ typing }) =>
  typing ? (
    <div className="typing-indicator">
      <span>User is typing...</span>
      <span className="dots" aria-hidden="true">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </span>
    </div>
  ) : null;

export default TypingIndicator;
