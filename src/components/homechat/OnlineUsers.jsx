// src/components/HomeChat/OnlineUsers.jsx
import React from 'react';

export default function OnlineUsers({ onlineUsers }) {
  return (
    <div style={{ fontSize: 12, padding: 8 }}>
      Online: <b>{onlineUsers.length}</b>
      <div style={{ marginTop: 6 }}>
        {onlineUsers.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No one online (or Presence auth failed).</div>
        ) : (
          onlineUsers.map((u) => (
            <div key={u.id}>{u.name || u.email || u.first_name || u.id}</div>
          ))
        )}
      </div>
    </div>
  );
}
