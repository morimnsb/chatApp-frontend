// src/reverb/echo.js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

const API =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:8000';

const REVERB_APP_KEY = import.meta.env.VITE_REVERB_APP_KEY || 'local';
const REVERB_HOST = import.meta.env.VITE_REVERB_HOST || '127.0.0.1';
const REVERB_PORT = Number(import.meta.env.VITE_REVERB_PORT || 8080);
const REVERB_TLS = String(import.meta.env.VITE_REVERB_TLS || 'false') === 'true';

// اگر پشت پروکسی هستی (مثلاً /app)
// در غیر این صورت خالی بگذار
const REVERB_PATH = import.meta.env.VITE_REVERB_PATH || '';

let echoInstance = null;
let lastToken = null;

const stripBearer = (t) => (t || '').toString().replace(/^Bearer\s+/i, '').trim();

function buildAuthHeaders(token) {
  const clean = stripBearer(token);
  return clean
    ? { Authorization: `Bearer ${clean}`, Accept: 'application/json' }
    : { Accept: 'application/json' };
}

export function getOrCreateEcho(accessToken) {
  const cleanToken = stripBearer(accessToken);
  if (!cleanToken) return null;

  // set global Pusher
  if (typeof window !== 'undefined') window.Pusher = Pusher;

  // 1) Create once
  if (!echoInstance) {
    echoInstance = new Echo({
      broadcaster: 'pusher',
      key: REVERB_APP_KEY,

      // ✅ برای pusher-js معمولاً لازم است
      cluster: 'mt1',
      disableStats: true,

      wsHost: REVERB_HOST,
      wsPort: REVERB_PORT,
      wssPort: REVERB_PORT,
      forceTLS: REVERB_TLS,

      enabledTransports: ['ws', 'wss'],

      // اگر route شما /api/broadcasting/auth است، این را تغییر بده
      authEndpoint: `${API}/broadcasting/auth`,

      auth: {
        headers: buildAuthHeaders(cleanToken),
      },

      ...(REVERB_PATH ? { wsPath: REVERB_PATH } : {}),
    });

    if (typeof window !== 'undefined') window.Echo = echoInstance;

    console.log('[Reverb] Echo created', {
      API,
      REVERB_HOST,
      REVERB_PORT,
      REVERB_TLS,
      REVERB_PATH,
    });

    lastToken = cleanToken;
    return echoInstance;
  }

  // 2) Update token without recreating
  if (lastToken !== cleanToken) {
    try {
      // آپدیت هدر auth داخل کانکتور
      const headers = buildAuthHeaders(cleanToken);

      // مسیر رایج در laravel-echo:
      // echoInstance.connector.options.auth.headers
      if (echoInstance.connector?.options?.auth?.headers) {
        echoInstance.connector.options.auth.headers = headers;
      }

      // بعضی نسخه‌ها:
      if (echoInstance.options?.auth?.headers) {
        echoInstance.options.auth.headers = headers;
      }

      // برای اطمینان: اگر وصل است، یک reconnect نرم
      try {
        echoInstance.disconnect();
      } catch {}
      try {
        echoInstance.connect();
      } catch {}
    } catch (e) {
      console.warn('[Reverb] failed to update auth headers, recreating...', e);
      try {
        echoInstance.disconnect();
      } catch {}
      echoInstance = null;
      lastToken = null;
      return getOrCreateEcho(cleanToken);
    }

    lastToken = cleanToken;
    console.log('[Reverb] Echo auth updated (token changed)');
  }

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
