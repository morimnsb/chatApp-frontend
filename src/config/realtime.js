// src/config/realtime.js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

Pusher.logToConsole = false;

// ✅ Echo در خیلی از حالت‌ها window.Pusher را می‌خواهد
try {
  window.Pusher = Pusher;
} catch (e) {
  console.warn(e);
}

let _echo = null;
let _echoTokenKey = null;

function readEnv() {
  const key = import.meta.env.VITE_PUSHER_KEY || 'local';
  const cluster = import.meta.env.VITE_PUSHER_CLUSTER || 'mt1';

  const wsHost = import.meta.env.VITE_PUSHER_HOST || '127.0.0.1';
  const wsPort = Number(import.meta.env.VITE_PUSHER_PORT || 8080);

  const forceTLS = String(import.meta.env.VITE_PUSHER_TLS ?? 'false') === 'true';

  // ✅ مهم: auth endpoint باید سمت بک‌اند باشه، نه 5173
  const authEndpoint =
    import.meta.env.VITE_PUSHER_AUTH_ENDPOINT ||
    import.meta.env.VITE_REVERB_AUTH_ENDPOINT ||
    'http://localhost:8000/api/broadcasting/auth';

  return { key, cluster, wsHost, wsPort, forceTLS, authEndpoint };
}

export function getOrCreateEcho(accessToken) {
  const tokenStr = accessToken ? String(accessToken) : '';
  const tokenKey = tokenStr ? tokenStr.slice(0, 18) : '';

  if (_echo && _echoTokenKey === tokenKey) return _echo;

  if (_echo && _echoTokenKey !== tokenKey) {
    disconnectEcho();
  }

  const { key, cluster, wsHost, wsPort, forceTLS, authEndpoint } = readEnv();
  if (!key || !cluster) return null;

  _echoTokenKey = tokenKey;

  _echo = new Echo({
    broadcaster: 'pusher',

    key,
    cluster,

    wsHost,
    wsPort,
    wssPort: wsPort,

    forceTLS,
    disableStats: true,
    enabledTransports: ['ws', 'wss'],

    // ✅ این باعث میشه Echo خودش به authEndpoint درخواست بده
    authEndpoint,
    auth: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });

  // برای usePresence که window.__echo می‌خواند
  try {
    window.__echo = _echo;
  } catch (e) {
    console.warn(e);
  }

  return _echo;
}

export function disconnectEcho() {
  try {
    _echo?.leaveAllChannels?.();
  } catch (e) {
    console.warn(e);
  }

  try {
    _echo?.disconnect?.();
  } catch (e) {
    console.warn(e);
  }

  _echo = null;
  _echoTokenKey = null;

  try {
    window.__echo = null;
  } catch (e) {
    console.warn(e);
  }
}

export function getEchoUnsafe() {
  return _echo;
}
