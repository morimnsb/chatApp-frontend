import { useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { isJwt } from '@/../../utils/jwt';
import { useSelector } from 'react-redux';

export default function useCurrentUser(accessToken, endpoints) {
  const currentUserFromStore = useSelector(
    (s) => s.auth?.currentUser?.id || s.messages?.currentUserId || null
  );
  const [currentUserId, setCurrentUserId] = useState(currentUserFromStore || null);

  // از استور یا JWT
  useEffect(() => {
    if (currentUserFromStore) { setCurrentUserId(currentUserFromStore); return; }
    if (isJwt(accessToken)) {
      try {
        const dec = jwtDecode(accessToken);
        const id = dec?.user_id ?? dec?.sub ?? null;
        if (id) setCurrentUserId(Number(id));
      } catch {}
    }
  }, [currentUserFromStore, accessToken]);

  // fallback /me
  useEffect(() => {
    const need = !currentUserId && !!accessToken && endpoints?.me;
    if (!need) return;
    let abort = false;
    (async () => {
      try {
        const resp = await fetch(endpoints.me, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!resp.ok) throw new Error(`GET /me ${resp.status}`);
        const me = await resp.json().catch(() => ({}));
        if (!abort && me?.id) setCurrentUserId(Number(me.id));
      } catch {}
    })();
    return () => { abort = true; };
  }, [currentUserId, accessToken, endpoints]);

  return currentUserId;
}

