import React from 'react';
import { Outlet } from 'react-router-dom';
import ChatRealtimeProvider from './ChatRealtimeProvider';

export default function ChatRealtimeLayout() {
  return (
    <ChatRealtimeProvider>
      <Outlet />
    </ChatRealtimeProvider>
  );
}
