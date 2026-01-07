// src/components/HomeChat/UsersPanel.jsx
import React, { memo } from 'react';

function UsersPanel({ usersQ, filteredUsers, onAddFriend, isSending }) {
  const loading = !!usersQ?.isLoading;
  const error = usersQ?.error;
  const refetch = usersQ?.refetch;

  return (
    <div
      style={{
        fontSize: 12,
        padding: '4px 8px',
        maxHeight: 120,
        overflowY: 'auto',
        borderTop: '1px solid rgba(0,0,0,0.05)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        marginBottom: 8,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>All users2222222 (RTK Query)</div>

      {loading && <div>Loading users…</div>}

      {!loading && error && (
        <div style={{ color: 'crimson' }}>
          Error loading users{' '}
          <button className="btn btn-link btn-sm" type="button" onClick={() => refetch?.()}>
            retry
          </button>
        </div>
      )}

      {!loading && !error && filteredUsers?.length === 0 && (
        <div style={{ opacity: 0.7 }}>No users found.</div>
      )}

      {!loading &&
        !error &&
        (filteredUsers || []).map((u) => (
          <div
            key={u.id || u.pk || u.email}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '2px 0',
            }}
          >
            <span>
              {u.first_name || u.firstName || u.name || u.email || 'user'}{' '}
              {u.last_name || u.lastName || ''}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              disabled={!!isSending}
              onClick={() => onAddFriend?.(u.id || u.pk)}
            >
              {isSending ? 'Sending…' : 'add friend'}
            </button>
          </div>
        ))}
    </div>
  );
}

export default memo(UsersPanel);
