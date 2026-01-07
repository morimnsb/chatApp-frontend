// src/reverb/echo.js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

const API =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:8000';

const REVERB_APP_KEY = import.meta.env.VITE_REVERB_APP_KEY || 'local';
const REVERB_HOST = import.meta.env.VITE_REVERB_HOST || '127.0.0.1';
const REVERB_PORT = Number(import.meta.env.VITE_REVERB_PORT || 8080);
const REVERB_TLS = String(import.meta.env.VITE_REVERB_TLS || 'false') === 'true';

let echoInstance = null;
let lastToken = null;

export function getOrCreateEcho(accessToken) {
  if (!accessToken) return null;

  if (echoInstance && lastToken === accessToken) return echoInstance;

  if (echoInstance) {
    try {
      echoInstance.disconnect();
    } catch {}
    echoInstance = null;
  }

  if (typeof window !== 'undefined') window.Pusher = Pusher;

  echoInstance = new Echo({
    broadcaster: 'pusher',
    key: REVERB_APP_KEY,

    // ✅ اجباری برای pusher-js (حتی اگر cloud استفاده نکنیم)
    cluster: 'mt1',
    disableStats: true,

    wsHost: REVERB_HOST,
    wsPort: REVERB_PORT,
    wssPort: REVERB_PORT,
    forceTLS: REVERB_TLS,

    enabledTransports: ['ws', 'wss'],

    authEndpoint: `${API}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    },
  });

  lastToken = accessToken;

  if (typeof window !== 'undefined') window.Echo = echoInstance;

  console.log('[Reverb] Echo created/updated', {
    API,
    REVERB_HOST,
    REVERB_PORT,
    REVERB_TLS,
  });

  return echoInstance;
}

export function disconnectEcho() {
  if (!echoInstance) return;
  try {
    echoInstance.disconnect();
  } catch {}
  echoInstance = null;
  lastToken = null;
}
