import { useMemo, useEffect, useState } from 'react';
import useFetch from '@/../../hooks/useFetch';

export default function useRoomMessages(roomId, endpoints, accessToken) {
  const [messages, setMessages] = useState([]);
  const fetchConfig = useMemo(
    () => (roomId ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
    [roomId, accessToken]
  );

  const { data, loading, error } = useFetch(
    roomId && endpoints?.roomMessages ? endpoints.roomMessages(roomId) : null,
    fetchConfig
  );

  useEffect(() => { if (Array.isArray(data)) setMessages(data); }, [data]);

  return { messages, setMessages, loading, fetchError: error };
}

