// src/reverb/echo.js
import Echo from 'laravel-echo';

const API =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:8000';

const REVERB_APP_KEY = import.meta.env.VITE_REVERB_APP_KEY || 'local';
const REVERB_HOST = import.meta.env.VITE_REVERB_HOST || '127.0.0.1';
const REVERB_PORT = Number(import.meta.env.VITE_REVERB_PORT || 8080);

let echoInstance = null;
let lastToken = null;

/**
 * یک Echo مشترک برای کل اپ:
 *  - اگر قبلاً ساخته شده و توکن همونه → همونو برمی‌گردونه
 *  - اگر توکن عوض شده → اتصال قبلی قطع و جدید ساخته می‌شه
 */
export function getOrCreateEcho(accessToken) {
  if (!accessToken) return null;

  if (echoInstance && lastToken === accessToken) {
    return echoInstance;
  }

  if (echoInstance) {
    try {
      echoInstance.disconnect();
    } catch {}
    echoInstance = null;
  }

  echoInstance = new Echo({
    broadcaster: 'reverb',
    key: REVERB_APP_KEY,
    wsHost: REVERB_HOST,
    wsPort: REVERB_PORT,
    wssPort: REVERB_PORT,
    forceTLS: false,
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

  if (typeof window !== 'undefined') {
    window.Echo = echoInstance;
  }

  console.log('[Reverb] Echo created/updated', {
    API,
    REVERB_HOST,
    REVERB_PORT,
  });

  return echoInstance;
}

export function disconnectEcho() {
  if (echoInstance) {
    try {
      echoInstance.disconnect();
    } catch {}
    echoInstance = null;
    lastToken = null;
  }
}
