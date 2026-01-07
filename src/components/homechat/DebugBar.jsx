// src/components/HomeChat/DebugBar.jsx
import React from 'react';

export default function DebugBar({ endpoints, usersQ }) {
  return (
    <div style={{ fontSize: 12, opacity: 0.85, padding: '4px 8px' }}>
      Effective backend: <b>{endpoints?.kind}</b>
      <div style={{ marginTop: 4 }}>
        RTK Query → users: {usersQ.isLoading ? 'loading' : usersQ.error ? 'error' : 'ok'}
      </div>
    </div>
  );
}
