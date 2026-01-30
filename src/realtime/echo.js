// chatApp-frontend/src/realtime/echo.js
import Echo from 'laravel-echo';

let _echo = null;
let _tokenKey = null;
let _createdCount = 0;

const DEBUG = import.meta.env.DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';
const log = (...a) => console.log('[Echo]', ...a);
const dlog = (...a) => DEBUG && console.log('[Echo][DBG]', ...a);
const dwarn = (...a) => DEBUG && console.warn('[Echo][WRN]', ...a);

function tokenKey(token) {
  const t = String(token || '');
  // کل توکن را نگه ندار (حساس است) — فقط یک key کوتاه
  return t ? t.slice(0, 18) : '';
}

function snapshotEcho(echo) {
  try {
    const conn = echo?.connector?.pusher?.connection;
    return {
      hasEcho: Boolean(echo),
      hasPusher: Boolean(echo?.connector?.pusher),
      connState: conn?.state,
      socketId: conn?.socket_id,
    };
  } catch {
    return { hasEcho: Boolean(echo) };
  }
}

function bindConnDebugOnce(echo) {
  try {
    const conn = echo?.connector?.pusher?.connection;
    if (!conn) return;
    if (conn.__debugBound) return; // ✅ فقط یکبار
    conn.__debugBound = true;

    dlog('bindConnDebugOnce()', { state: conn.state, socketId: conn.socket_id });

    conn.bind?.('state_change', (st) => dlog('conn state_change', st));
    conn.bind?.('connected', () => dlog('conn connected', { socketId: conn.socket_id }));
    conn.bind?.('disconnected', () => dlog('conn disconnected', { socketId: conn.socket_id }));
    conn.bind?.('error', (err) => dwarn('conn error', err));
  } catch (e) {
    dwarn('bindConnDebugOnce failed', e);
  }
}

export function getOrCreateEcho(bearerToken) {
  const nextKey = tokenKey(bearerToken);

  dlog('getOrCreateEcho() called', {
    nextKey,
    prevKey: _tokenKey,
    createdCount: _createdCount,
    current: snapshotEcho(_echo),
  });

  // اگر Echo داریم و توکن key عوض نشده، همون را بده
  if (_echo && _tokenKey === nextKey) {
    dlog('reuse existing echo ✅', snapshotEcho(_echo));
    return _echo;
  }

  const wsHost = import.meta.env.VITE_REVERB_HOST || '127.0.0.1';
  const wsPort = Number(import.meta.env.VITE_REVERB_PORT || 8080);
  const key = import.meta.env.VITE_REVERB_APP_KEY || 'localkey';
  const scheme = import.meta.env.VITE_REVERB_SCHEME || 'http';
  const authEndpoint = 'http://localhost:8000/broadcasting/auth';

  dlog('config', { wsHost, wsPort, key, scheme, authEndpoint });

  // اگر Echo قبلی داریم ولی توکن عوض شده:
  // بهتره فقط هدر را آپدیت کنیم (بدون ساختن اتصال جدید)
  if (_echo) {
    try {
      const before = snapshotEcho(_echo);
      _echo.connector.pusher.config.auth.headers.Authorization = `Bearer ${bearerToken}`;
      _tokenKey = nextKey;

      dlog('updated auth header on existing echo ✅', {
        before,
        after: snapshotEcho(_echo),
        tokenKey: nextKey,
      });

      bindConnDebugOnce(_echo);
      return _echo;
    } catch (e) {
      dwarn('update header failed -> disconnect & recreate', e);
      // اگر نشد، fallback: destroy و بساز
      try {
        _echo.disconnect();
        dlog('old echo disconnected');
      } catch (e2) {
        dwarn('old echo disconnect failed', e2);
      }
      _echo = null;
    }
  }

  _createdCount += 1;
  log('creating new Echo instance', { createdCount: _createdCount, tokenKey: nextKey });

  _echo = new Echo({
    broadcaster: 'reverb',
    key,
    wsHost,
    wsPort,
    wssPort: wsPort,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint,
    auth: {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    },
  });

  _tokenKey = nextKey;

  // Optional: برای دیباگ جهانی
  window.__echo = _echo;

  dlog('new echo created ✅', snapshotEcho(_echo));

  bindConnDebugOnce(_echo);

  // یک snapshot کوتاه بعد از یک tick (گاهی socket_id بعداً ست میشه)
  try {
    setTimeout(() => dlog('post-create snapshot (300ms)', snapshotEcho(_echo)), 300);
  } catch {}

  return _echo;
}

// (اختیاری) برای تست دستی در کنسول
export function __debugEchoSnapshot() {
  return {
    tokenKey: _tokenKey,
    createdCount: _createdCount,
    snap: snapshotEcho(_echo),
  };
}
