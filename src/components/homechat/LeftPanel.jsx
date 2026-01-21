// import React, { memo } from 'react';
// import OnlineUsers from './OnlineUsers';
// import UsersPanel from './UsersPanel';

// function LeftPanel({ endpoints, usersQ, onlineUsers, filteredUsers, onAddFriend, isSending }) {
//   const usersStatus = usersQ?.isLoading ? 'loading' : usersQ?.error ? 'error' : 'ok';

//   return (
//     <>
//       <div style={{ fontSize: 12, opacity: 0.85, padding: '4px 8px' }}>
//         Effective backend: <b>{endpoints?.kind}</b>
//         <div style={{ marginTop: 4 }}>RTK Query → users: {usersStatus}</div>
//       </div>

//       <OnlineUsers onlineUsers={onlineUsers} />

//       <UsersPanel
//         usersQ={usersQ}
//         filteredUsers={filteredUsers}
//         onAddFriend={onAddFriend}
//         isSending={isSending}
//       />
//     </>
//   );
// }

// export default memo(LeftPanel);
