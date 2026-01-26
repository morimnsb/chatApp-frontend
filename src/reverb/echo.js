// src/reverb/echo.js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

const API =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:8000';

const REVERB_APP_KEY = import.meta.env.VITE_REVERB_APP_KEY || 'local';
const REVERB_HOST = import.meta.env.VITE_REVERB_HOST || '127.0.0.1';
const REVERB_PORT = Number(import.meta.env.VITE_REVERB_PORT || 8080);
const REVERB_TLS = String(import.meta.env.VITE_REVERB_TLS || 'false') === 'true';
const REVERB_PATH = import.meta.env.VITE_REVERB_PATH || '';

const DEV = import.meta.env.DEV === true;
const LOG = DEV && String(import.meta.env.VITE_WS_DEBUG || '') === 'true';

let echoInstance = null;
let lastToken = null;

const stripBearer = (t) => (t || '').toString().replace(/^Bearer\s+/i, '').trim();

function buildAuthHeaders(token) {
  const clean = stripBearer(token);
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (clean) headers.Authorization = `Bearer ${clean}`;
  return headers;
}

/**
 * ✅ Authorizer سفارشی:
 * - تضمین می‌کنه Authorization header همیشه ارسال بشه
 * - لاگ دقیق channel_name/socket_id می‌ده
 */
function makeAuthorizer(authEndpoint, token) {
  const headers = buildAuthHeaders(token);

  return (channel /*, options */) => {
    return {
      authorize: async (socketId, callback) => {
        try {
          const body = new URLSearchParams();
          body.set('socket_id', socketId);
          body.set('channel_name', channel.name);

          if (LOG) {
            console.log('[Reverb][Auth] authorize →', {
              authEndpoint,
              channel: channel.name,
              socketId,
              hasAuth: Boolean(headers.Authorization),
              authPrefix: headers.Authorization
                ? headers.Authorization.slice(0, 18) + '…'
                : null,
            });
          }

          const resp = await fetch(authEndpoint, {
            method: 'POST',
            headers,
            body,
          });

          const text = await resp.text().catch(() => '');
          if (!resp.ok) {
            if (LOG) {
              console.warn('[Reverb][Auth] FAILED', {
                status: resp.status,
                channel: channel.name,
                bodyPreview: text.slice(0, 200),
              });
            }
            // pusher expects callback(true, data)
            callback(true, { status: resp.status, body: text });
            return;
          }

          const data = text ? JSON.parse(text) : {};
          callback(false, data);
        } catch (e) {
          if (LOG) console.warn('[Reverb][Auth] ERROR', e);
          callback(true, { message: e?.message || 'authorize error' });
        }
      },
    };
  };
}

function softReconnect(echo) {
  try {
    echo.disconnect();
  } catch {}
  try {
    echo.connect();
  } catch {}
}

export function getOrCreateEcho(accessToken) {
  const cleanToken = stripBearer(accessToken);
  if (!cleanToken) return null;

  if (typeof window !== 'undefined' && !window.Pusher) window.Pusher = Pusher;

  const authEndpoint = `${API}/api/broadcasting/auth`;


  if (!echoInstance) {
    echoInstance = new Echo({
  broadcaster: 'pusher',
  key: REVERB_APP_KEY,

  cluster: 'mt1',          // ✅ FIX CRASH
  disableStats: true,

  wsHost: REVERB_HOST,
  wsPort: REVERB_PORT,
  wssPort: REVERB_PORT,
  forceTLS: REVERB_TLS,

  enabledTransports: REVERB_TLS ? ['wss', 'ws'] : ['ws', 'wss'],

  authEndpoint,
  authorizer: makeAuthorizer(authEndpoint, cleanToken),

      ...(REVERB_PATH ? { wsPath: REVERB_PATH } : {}),

      // ✅ اگر یک جایی هنوز pusher-js گیر cluster داد، این رو روشن کن:
      // cluster: 'mt1',
    });

    if (typeof window !== 'undefined') {
      window.Echo = echoInstance;
      window.__echo = echoInstance;
    }

    lastToken = cleanToken;

    if (LOG) {
      console.log('[Reverb] Echo created', {
        authEndpoint,
        host: REVERB_HOST,
        port: REVERB_PORT,
        tls: REVERB_TLS,
        path: REVERB_PATH,
        tokenPrefix: cleanToken.slice(0, 10) + '…',
      });
    }

    return echoInstance;
  }

  // token changed → update authorizer + reconnect
  if (lastToken !== cleanToken) {
    echoInstance.options = echoInstance.options || {};
    echoInstance.options.authEndpoint = authEndpoint;
    echoInstance.options.authorizer = makeAuthorizer(authEndpoint, cleanToken);

    lastToken = cleanToken;

    if (LOG) console.log('[Reverb] Echo auth updated (token changed)');

    softReconnect(echoInstance);
  }

  return echoInstance;
}

export function disconnectEcho() {
  if (!echoInstance) return;

  if (LOG) console.log('[Reverb] Echo disconnect');
  try {
    echoInstance.disconnect();
  } catch {}

  echoInstance = null;
  lastToken = null;

  if (typeof window !== 'undefined') {
    try {
      delete window.Echo;
      delete window.__echo;
    } catch {
      window.Echo = undefined;
      window.__echo = undefined;
    }
  }
}
