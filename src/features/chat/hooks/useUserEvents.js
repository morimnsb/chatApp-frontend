// chatApp-frontend/src/features/chat/hooks/useUserEvents.js
import { useEffect, useRef } from 'react';
import { getOrCreateEcho } from '@/shared/config/realtime.js';

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';

const log = (...a) => DEBUG && console.log('[UserEvents]', ...a);
const dlog = (...a) => DEBUG && console.log('[UserEvents][DBG]', ...a);

const USER_EVENTS = [
  '.direct.message',
  'direct.message',
  'chat:notify',
  '.chat:notify',

  // ✅ NEW (your backend emits this)
  'user.notify',
  '.user.notify',
];

const ROOM_EVENTS = [
  '.ChatMessageCreated',
  'ChatMessageCreated',
  'chat:message',
  '.chat:message',

  // ✅ NEW (your backend emits this)
  'chat.message',
  '.chat.message',

  'typing_indicator',
  '.typing_indicator',
];



function safePreview(x, n = 220) {
  try {
    const s = typeof x === 'string' ? x : JSON.stringify(x);
    return s.length > n ? s.slice(0, n) + '…' : s;
  } catch {
    return String(x);
  }
}

export default function useUserEvents({
  effectiveKind,
  accessToken,
  currentUserId,
  selectedRoomId = null,
  onNotify, // (payload, meta)
}) {
  const onNotifyRef = useRef(onNotify);
  useEffect(() => {
    onNotifyRef.current = onNotify;
  }, [onNotify]);

  // ✅ NEW: keep latest selectedRoomId without re-subscribing USER channel
  const selectedRoomIdRef = useRef(selectedRoomId);
  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);

  const userSubRef = useRef({
    key: null,
    echo: null,
    channelName: null,
    channel: null,
    binds: [],
    onceConnected: null,
  });

  // -------------------------
  // USER CHANNEL (does NOT depend on selectedRoomId)
  // -------------------------
  useEffect(() => {
    const kind = String(effectiveKind || '').toLowerCase();
    const isReverb = kind === 'reverb';
    if (!isReverb) return undefined;

    const cleanup = (reason = 'cleanup') => {
      const prev = userSubRef.current;

      dlog('cleanup(USER)()', {
        reason,
        key: prev.key,
        channelName: prev.channelName,
        hasChannel: Boolean(prev.channel),
      });

      try {
        const conn = prev.echo?.connector?.pusher?.connection;
        if (conn && prev.onceConnected) conn.unbind?.('connected', prev.onceConnected);
      } catch {}

      if (prev.channel) {
        for (const ev of USER_EVENTS) {
          try { prev.channel.stopListening(ev); } catch {}
        }
      }

      try {
        const pch = prev.channel?.pusher?.channels?.channels?.[`private-${prev.channelName}`];
        prev.binds?.forEach((fn) => pch?.unbind_global?.(fn));
      } catch {}

      if (prev.echo && prev.channelName) {
        try { prev.echo.leave(prev.channelName); } catch {}
      }

      userSubRef.current = {
        key: null,
        echo: prev.echo || null,
        channelName: null,
        channel: null,
        binds: [],
        onceConnected: null,
      };
    };

    const token = String(accessToken || '').trim();
    const uid = Number(currentUserId) > 0 ? Number(currentUserId) : null;

    if (!token || !uid) {
      cleanup('not-ready');
      return undefined;
    }

    const echo = getOrCreateEcho(accessToken);
    if (!echo) {
      cleanup('no-echo');
      return undefined;
    }

    const channelName = `user.${uid}`;
    const tokenKey = token.replace(/^Bearer\s+/i, '').slice(0, 16);
    const nextKey = `${kind}|${channelName}|${tokenKey}`;

    if (userSubRef.current.key === nextKey && userSubRef.current.channel) {
      dlog('USER same key -> skip');
      return undefined;
    }

    cleanup('before-subscribe');

    const conn = echo.connector?.pusher?.connection;

    const doSubscribe = () => {
      log('subscribing(USER)', { channelName });

      const channel = echo.private(channelName);
      const binds = [];

      try {
        const pch = channel?.pusher?.channels?.channels?.[`private-${channelName}`];
        if (pch?.bind_global) {
          const fn = (eventName, data) =>
            dlog('GLOBAL(USER)', { eventName, dataPreview: safePreview(data) });
          pch.bind_global(fn);
          binds.push(fn);
        }
      } catch {}

      USER_EVENTS.forEach((ev) => {
        channel.listen(ev, (payload) => {
          log('EVENT(USER)', { ev, payloadPreview: safePreview(payload) });

          // ✅ IMPORTANT: use selectedRoomIdRef so it stays fresh without re-subscribe
          onNotifyRef.current?.(payload, {
            source: 'reverb:user',
            eventName: ev,
            selectedRoomId: selectedRoomIdRef.current,
            currentUserId,
          });
        });
      });

      userSubRef.current = {
        ...userSubRef.current,
        key: nextKey,
        echo,
        channelName,
        channel,
        binds,
      };
    };

    if (conn?.state === 'connected') {
      doSubscribe();
    } else {
      const once = () => {
        try { conn?.unbind?.('connected', once); } catch {}
        doSubscribe();
      };
      userSubRef.current.onceConnected = once;
      try { conn?.bind?.('connected', once); } catch {}
    }

    userSubRef.current.echo = echo;
    userSubRef.current.key = nextKey;

    return () => cleanup('effect-return');
    // ✅ REMOVED selectedRoomId from deps on purpose
  }, [effectiveKind, accessToken, currentUserId]);

  // -------------------------
  // ROOM CHANNEL (depends on selectedRoomId)
  // -------------------------
  const roomSubRef = useRef({
    key: null,
    echo: null,
    roomId: null,
    channelName: null,
    channel: null,
    binds: [],
  });

  useEffect(() => {
    const kind = String(effectiveKind || '').toLowerCase();
    const isReverb = kind === 'reverb';
    if (!isReverb) return undefined;

    const token = String(accessToken || '').trim();
    const uid = Number(currentUserId) > 0 ? Number(currentUserId) : null;
    const rid = Number(selectedRoomId) > 0 ? Number(selectedRoomId) : null;

    const cleanupRoom = (reason = 'cleanup-room', forceLeave = true) => {
      const prev = roomSubRef.current;

      dlog('cleanup(ROOM)()', {
        reason,
        key: prev.key,
        channelName: prev.channelName,
        roomId: prev.roomId,
        hasChannel: Boolean(prev.channel),
      });

      if (prev.channel) {
        for (const ev of ROOM_EVENTS) {
          try { prev.channel.stopListening(ev); } catch {}
        }
      }

      try {
        const pch = prev.channel?.pusher?.channels?.channels?.[`private-${prev.channelName}`];
        prev.binds?.forEach((fn) => pch?.unbind_global?.(fn));
      } catch {}

      if (forceLeave && prev.echo && prev.channelName) {
        try { prev.echo.leave(prev.channelName); } catch {}
      }

      roomSubRef.current = {
        key: null,
        echo: prev.echo || null,
        roomId: null,
        channelName: null,
        channel: null,
        binds: [],
      };
    };

    if (!token || !uid) {
      cleanupRoom('not-ready');
      return undefined;
    }

    const echo = getOrCreateEcho(accessToken);
    if (!echo) {
      cleanupRoom('no-echo');
      return undefined;
    }

    if (!rid) {
      if (roomSubRef.current.channelName) cleanupRoom('no-room-selected');
      return undefined;
    }

    const channelName = `chat.${rid}`;
    const tokenKey = token.replace(/^Bearer\s+/i, '').slice(0, 16);
    const nextKey = `${kind}|${channelName}|${tokenKey}`;

    if (roomSubRef.current.key === nextKey && roomSubRef.current.channel) {
      dlog('ROOM same key -> skip');
      return undefined;
    }

    if (roomSubRef.current.channelName && roomSubRef.current.channelName !== channelName) {
      cleanupRoom('switch-room');
    } else {
      cleanupRoom('before-room-subscribe', false);
    }

    log('subscribing(ROOM)', { channelName, selectedRoomId: rid });

    const channel = echo.private(channelName);
    const binds = [];

    try {
      const pch = channel?.pusher?.channels?.channels?.[`private-${channelName}`];
      if (pch?.bind_global) {
        const fn = (eventName, data) =>
          dlog('GLOBAL(ROOM)', { eventName, dataPreview: safePreview(data) });
        pch.bind_global(fn);
        binds.push(fn);
      }
    } catch {}

    ROOM_EVENTS.forEach((ev) => {
      channel.listen(ev, (payload) => {
        log('EVENT(ROOM)', { ev, payloadPreview: safePreview(payload) });

        onNotifyRef.current?.(payload, {
          source: 'reverb:room',
          eventName: ev,
          selectedRoomId: rid,
          currentUserId,
        });
      });
    });

    roomSubRef.current = {
      key: nextKey,
      echo,
      roomId: rid,
      channelName,
      channel,
      binds,
    };

    return () => cleanupRoom('effect-return');
  }, [effectiveKind, accessToken, currentUserId, selectedRoomId]);

  return null;
}
