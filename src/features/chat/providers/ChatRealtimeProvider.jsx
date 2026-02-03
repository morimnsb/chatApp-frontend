import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';

// hooks شما
import useUserEvents from '@/features/chat/hooks/useUserEvents';
import { useGlobalNotify } from '@/features/chat/hooks/useGlobalNotify';

// selectors
import { selectBootstrapped, selectToken } from '@/app/store/authSlice';

export default function ChatRealtimeProvider({ children }) {
  const bootstrapped = useSelector(selectBootstrapped);

  // تو پروژه‌ات token تو authSlice هست
  const token = useSelector(selectToken);

  // currentUserId از state (با توجه به ساختار شما)
  const currentUserId = useSelector(
    (s) =>
      s.auth?.user?.id ??
      s.auth?.user?.user_id ??
      s.auth?.currentUser?.id ??
      s.auth?.currentUser?.user_id ??
      null
  );

  // selectedRoomId برای اینکه وقتی همون روم بازه toast نخوره
  const selectedRoomId = useSelector(
    (s) => s.messages?.selectedRoom?.id ?? s.messages?.selectedRoom ?? null
  );

  const effectiveKind = useMemo(() => 'reverb', []);

  const shouldEnable = Boolean(bootstrapped && token && currentUserId);

  const handleGlobalNotify = useGlobalNotify({ selectedRoom: selectedRoomId });

  // ✅ فقط وقتی shouldEnable true باشه روشن میشه
  useUserEvents({
    effectiveKind,
    accessToken: shouldEnable ? token : null,
    currentUserId: shouldEnable ? currentUserId : null,
    selectedRoomId,
    onNotify: handleGlobalNotify,
  });

  return children;
}
