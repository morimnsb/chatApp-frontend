// src/hooks/chat/useAuthBasics.js
import { useSelector } from 'react-redux';

const stripBearer = (t) => (t || '').toString().replace(/^Bearer\s+/i, '');

export function useAuthBasics() {
  const accessToken = useSelector((s) => s.auth?.access_token ?? s.auth?.token) || '';

  const currentUser =
    useSelector((s) => s.auth?.currentUser ?? s.auth?.user ?? s.messages?.currentUser) ?? null;

  const currentUserId =
    currentUser?.id ?? currentUser?.user_id ?? currentUser?.userId ?? currentUser?.pk ?? null;

  const bareToken = stripBearer(accessToken);

  return { bareToken, currentUser, currentUserId };
}
