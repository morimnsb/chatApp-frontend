// src/reverb/echo.js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

if (typeof window !== 'undefined') {
  window.Pusher = Pusher;
}

// helper برای خواندن env در هر دو دنیا (Vite و CRA)
const readEnv = (keys, fallback = undefined) => {
  // Vite
  const vite = (typeof import.meta !== 'undefined' && import.meta.env) || {};
  for (const k of keys) {
    if (vite[k] !== undefined) return vite[k];
  }
  // CRA
  for (const k of keys) {
    if (process.env && process.env[k] !== undefined) return process.env[k];
  }
  return fallback;
};

const toBool = (v, def = false) => {
  if (v === undefined || v === null || v === '') return def;
  if (typeof v === 'boolean') return v;
  return v === '1' || v === 'true';
};

export function makeEcho(token) {
  // توجه: اگر CRA هستی این‌ها باید با پیشوند REACT_APP_ توی .env ست بشن
  const apiUrl = readEnv(
    ['VITE_API_URL', 'REACT_APP_API_URL'],
    'http://localhost:8000',
  );
  const driver = (
    readEnv(['VITE_ECHO_DRIVER', 'REACT_APP_ECHO_DRIVER'], 'reverb') || 'reverb'
  ).toLowerCase();

  const isHttps =
    typeof window !== 'undefined' && window.location.protocol === 'https:';

  if (driver === 'reverb') {
    const key = readEnv(
      ['VITE_REVERB_APP_KEY', 'REACT_APP_REVERB_APP_KEY'],
      'app-key',
    );
    const wsHost = readEnv(
      ['VITE_REVERB_HOST', 'REACT_APP_REVERB_HOST'],
      typeof window !== 'undefined' ? window.location.hostname : 'localhost',
    );
    const wsPort = Number(
      readEnv(['VITE_REVERB_PORT', 'REACT_APP_REVERB_PORT'], 8080),
    );
    const tls = toBool(
      readEnv(['VITE_REVERB_TLS', 'REACT_APP_REVERB_TLS'], isHttps),
    );
    const wssPort = Number(
      readEnv(['VITE_REVERB_WSS_PORT', 'REACT_APP_REVERB_WSS_PORT'], 443),
    );

    return new Echo({
      broadcaster: 'reverb',
      key,
      wsHost,
      wsPort: tls ? undefined : wsPort,
      wssPort: tls ? wssPort : undefined,
      forceTLS: tls,
      enabledTransports: tls ? ['wss'] : ['ws'],
      disableStats: true,
      authorizer: (channel) => ({
        authorize: (socketId, callback) => {
          fetch(`${apiUrl}/broadcasting/auth`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Socket-ID': socketId,
              Authorization: token
                ? `Bearer ${token.replace(/^Bearer\s+/i, '')}`
                : '',
            },
            body: JSON.stringify({ channel_name: channel.name }),
            credentials: 'include',
          })
            .then(async (r) => {
              if (!r.ok)
                throw new Error(
                  `${r.status} ${await r.text().catch(() => '')}`,
                );
              return r.json();
            })
            .then((data) => callback(false, data))
            .catch((err) => {
              console.error('[Echo authorizer Reverb] Failed:', err);
              callback(true, err);
            });
        },
      }),
    });
  }

  // --- Pusher SaaS ---
  const key = readEnv(['VITE_PUSHER_KEY', 'REACT_APP_PUSHER_KEY']);
  const cluster = readEnv(['VITE_PUSHER_CLUSTER', 'REACT_APP_PUSHER_CLUSTER']);
  if (!key || !cluster) {
    throw new Error('[Echo] Pusher config missing KEY or CLUSTER');
  }

  return new Echo({
    broadcaster: 'pusher',
    key,
    cluster,
    forceTLS: isHttps,
    authorizer: (channel) => ({
      authorize: (socketId, callback) => {
        fetch(`${apiUrl}/broadcasting/auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Socket-ID': socketId,
            Authorization: token
              ? `Bearer ${token.replace(/^Bearer\s+/i, '')}`
              : '',
          },
          body: JSON.stringify({ channel_name: channel.name }),
        })
          .then(async (r) => {
            if (!r.ok)
              throw new Error(`${r.status} ${await r.text().catch(() => '')}`);
            return r.json();
          })
          .then((data) => callback(false, data))
          .catch((err) => {
            console.error('[Echo authorizer Pusher] Failed:', err);
            callback(true, err);
          });
      },
    }),
  });
}
