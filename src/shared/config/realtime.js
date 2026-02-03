// src/shared/config/realtime.js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

Pusher.logToConsole = false;

try {
  window.Pusher = Pusher;
} catch {}

let _echo = null;
let _echoKeySig = null;

function readEnv() {
  const key = import.meta.env.VITE_PUSHER_KEY || 'local';
  const wsHost = import.meta.env.VITE_PUSHER_HOST || '127.0.0.1';
  const wsPort = Number(import.meta.env.VITE_PUSHER_PORT || 8080);

  const forceTLS = String(import.meta.env.VITE_PUSHER_TLS ?? 'false') === 'true';

  const authEndpoint =
    import.meta.env.VITE_PUSHER_AUTH_ENDPOINT ||
    import.meta.env.VITE_REVERB_AUTH_ENDPOINT ||
    'http://127.0.0.1:8000/api/broadcasting/auth';

  const enabledTransports = forceTLS ? ['wss'] : ['ws'];

  return { key, wsHost, wsPort, forceTLS, authEndpoint, enabledTransports };
}

function makeSig(env, accessToken) {
  const tokenStr = accessToken ? String(accessToken) : '';
  const tokenKey = tokenStr ? tokenStr.slice(0, 18) : '';

  return [
    env.key,
    env.wsHost,
    env.wsPort,
    env.forceTLS ? 'tls1' : 'tls0',
    env.enabledTransports.join(','),
    env.authEndpoint,
    tokenKey,
  ].join('|');
}

export function getOrCreateEcho(accessToken) {
  const env = readEnv();
  if (!env.key) return null;

  const nextSig = makeSig(env, accessToken);

  if (_echo && _echoKeySig === nextSig) return _echo;

  if (_echo) disconnectEcho('rebuild');

  _echoKeySig = nextSig;

  _echo = new Echo({
    broadcaster: 'reverb',
    key: env.key,

    wsHost: env.wsHost,
    wsPort: env.wsPort,
    wssPort: env.wsPort,

    forceTLS: env.forceTLS,
    encrypted: env.forceTLS,

    enabledTransports: env.enabledTransports,
    disableStats: true,

    authEndpoint: env.authEndpoint,
    auth: {
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
        : { Accept: 'application/json' },
    },
  });

  try {
    window.__echo = _echo;
  } catch {}

  return _echo;
}

export function disconnectEcho(reason = 'manual') {
  try {
    _echo?.leaveAllChannels?.();
  } catch {}

  try {
    _echo?.disconnect?.();
  } catch {}

  _echo = null;
  _echoKeySig = null;

  try {
    window.__echo = null;
  } catch {}

  // console.log('[realtime] disconnectEcho', reason);
}

export function getEchoUnsafe() {
  return _echo;
}
