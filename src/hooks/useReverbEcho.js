// src/hooks/useReverbEcho.js
import { useEffect, useRef } from 'react';
import { makeEcho } from '../reverb/echo';

export default function useReverbEcho({ effectiveKind, accessToken }) {
  const echoRef = useRef(null);

  useEffect(() => {
    if (effectiveKind !== 'reverb') {
      if (echoRef.current) {
        try {
          echoRef.current.leave('room.1');
          echoRef.current.leave('presence.room.1');
          echoRef.current.disconnect();
        } catch {}
        echoRef.current = null;
      }
      return;
    }

    if (!accessToken || echoRef.current) return;

    const echo = makeEcho(accessToken);
    if (!echo) {
      console.warn('[Echo] not initialized (missing cluster or key)');
      return;
    }

    echoRef.current = echo;

    echo.channel('room.1').listen('.chat.message', (e) => {
      console.log('[Echo] chat.message:', e);
      // TODO: dispatch(updateMessages(e))
    });

    echo
      .join('presence.room.1')
      .here((members) => console.log('[Echo] here', members))
      .joining((m) => console.log('[Echo] joining', m))
      .leaving((m) => console.log('[Echo] leaving', m))
      .listen('.typing.indicator', (e) =>
        console.log('[Echo] typing.indicator:', e),
      );

    return () => {
      try {
        echo.leave('room.1');
        echo.leave('presence.room.1');
      } catch {}
      echo.disconnect();
      echoRef.current = null;
    };
  }, [effectiveKind, accessToken]);

  return echoRef;
}
