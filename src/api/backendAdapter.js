// src/api/backendAdapter.js
// لایه‌ی یکپارچه‌سازی مسیرها برای Laravel/Django (+ حالت Laravel Reverb)

const BACKEND = (process.env.REACT_APP_BACKEND || 'laravel').toLowerCase();
const API =
  process.env.REACT_APP_API_URL?.replace(/\/+$/, '') || 'http://localhost:8000';

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const commonWsBase =
  process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws/chat/';

// --- پروفایل هر بک‌اند ---
const profiles = {
  laravel: {
    me: `${API}/api/auth/me`,
    users: `${API}/api/auth/users`,
    convos: `${API}/chatMeetUp/conversations/`, // ممکنه 404 بده؛ پایین هندل می‌کنیم
    rooms: `${API}/chatMeetUp/chatrooms/`,
    friend: `${API}/chatMeetUp/friendship/`,
    wsBase: commonWsBase,
    kind: 'laravel',
  },
  django: {
    me: `${API}/api/auth/me/`,
    users: `${API}/api/auth/users/`,
    convos: `${API}/api/chat/conversations/`,
    rooms: `${API}/api/chat/rooms/`,
    friend: `${API}/api/chat/friendship/`,
    wsBase: commonWsBase,
    kind: 'django',
  },
  // اگر Reverb/Echo داری، WS خام لازم نیست؛ کانفیگ Reverb را این‌جا می‌دهیم
  laravel_reverb: {
    me: `${API}/api/auth/me`,
    users: `${API}/api/auth/users`,
    convos: `${API}/chatMeetUp/conversations/`,
    rooms: `${API}/chatMeetUp/chatrooms/`,
    friend: `${API}/chatMeetUp/friendship/`,
    // wsBase عملاً استفاده نمی‌شود؛ از pusher-js استفاده می‌کنیم
    wsBase: null,
    kind: 'laravel_reverb',
    reverb: {
      appKey: process.env.REACT_APP_REVERB_APP_KEY || 'app-key',
      host: process.env.REACT_APP_REVERB_HOST || '127.0.0.1',
      port: Number(process.env.REACT_APP_REVERB_PORT || 8080),
      forceTLS:
        (process.env.REACT_APP_REVERB_TLS || 'false').toLowerCase() === 'true',
    },
  },
};

const routes = profiles[BACKEND] || profiles.laravel;

// --- fetch کمکی با تحمل HTML/متن خطا ---
async function request(url, token, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeader(token),
      ...(opts.headers || {}),
    },
  });

  let bodyText = '';
  try {
    bodyText = await res.text();
  } catch {
    /* ignore */
  }

  let data = null;
  try {
    data = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    data = { __raw: bodyText };
  }

  return { ok: res.ok, status: res.status, data };
}

// --- نرمال‌ساز‌ها ---
function normalizeRooms(raw) {
  if (Array.isArray(raw)) return raw.map((r) => ({ id: r.id, name: r.name }));
  if (raw?.rooms && Array.isArray(raw.rooms)) {
    return raw.rooms.map((r) => ({ id: r.id, name: r.name }));
  }
  return [];
}
function normalizeConversations(raw) {
  if (raw?.partners && Array.isArray(raw.partners)) return raw;
  if (Array.isArray(raw)) return { partners: raw };
  return { partners: [] };
}
function normalizeUsers(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.results)) return raw.results;
  return [];
}

export const api = {
  BACKEND: routes.kind,
  REVERB: routes.reverb || null,

  wsUrlWithToken(token) {
    if (!routes.wsBase) return null; // در حالت reverb برمی‌گردونیم null
    const sep = routes.wsBase.includes('?') ? '&' : '?';
    return `${routes.wsBase}${sep}token=${encodeURIComponent(token || '')}`;
  },

  async me(token) {
    return request(routes.me, token);
  },

  async users(token) {
    const res = await request(routes.users, token);
    return { ...res, data: normalizeUsers(res.data) };
  },

  async rooms(token) {
    const res = await request(routes.rooms, token);
    return { ...res, data: normalizeRooms(res.data) };
  },

  async conversations(token) {
    // 404 را نرم برگردان
    const res = await request(routes.convos, token);
    if (!res.ok && res.status === 404) {
      return { ok: true, status: 200, data: { partners: [] } };
    }
    return { ...res, data: normalizeConversations(res.data) };
  },

  async sendFriendRequest(token, to_user_id) {
    return request(routes.friend, token, {
      method: 'POST',
      body: JSON.stringify({ to_user_id }),
    });
  },
};
