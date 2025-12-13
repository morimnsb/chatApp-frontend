// src/hooks/useCurrentUser.js
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setCurrentUser } from '@/actions/messageActions';
import { decodeUserIdFromToken } from '@/utils/jwt';

export default function useCurrentUser({
  accessToken,
  effectiveKind,
  endpoints,
}) {
  const dispatch = useDispatch();

  useEffect(() => {
    // JWT → user_id
    const fromJwt = decodeUserIdFromToken(accessToken);
    if (fromJwt) {
      dispatch(setCurrentUser(fromJwt));
      return; // دیگه نیاز به /me نیست
    }

    // لاراول: /auth/me/
    if (effectiveKind === 'laravel' && accessToken) {
      (async () => {
        try {
          const resp = await fetch(endpoints.me, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!resp.ok) return;
          const me = await resp.json();
          if (me?.id) dispatch(setCurrentUser(me.id));
        } catch {
          /* no-op */
        }
      })();
    }
  }, [accessToken, effectiveKind, endpoints.me, dispatch]);
}

