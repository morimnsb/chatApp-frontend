// تشخیص خودکار: laravel یا django + مسیرهای API + کاندیدهای WS
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function tryJson(url, token) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', ...authHeader(token) },
    });
    const txt = await res.text();
    let data = null;
    try {
      data = txt ? JSON.parse(txt) : null;
    } catch {
      data = { __raw: txt };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e };
  }
}

function laravelRoutes() {
  return {
    kind: 'laravel',
    me: `${API}/api/auth/me`,
    users: `${API}/api/auth/users`,
    convos: `${API}/chatMeetUp/conversations`,
    rooms: `${API}/chatMeetUp/chatrooms/`,
    friend: `${API}/chatMeetUp/friendship/`,
    // کاندیدهای معمول برای WS در لارا: (بسته به راه‌اندازی شما یکی کار می‌کند)
    wsCandidates: [
      // خام/کاستم
      `${API}`.replace(/^http/, 'ws') + `/ws/chat/`,
      // Reverb پیش‌فرض
      `${API}`.replace(/^http/, 'ws') + `:8080/app`, // اگر روی پورت 8080
      // Laravel Echo Server / پشر self-hosted
      `${API}`.replace(/^http/, 'ws') + `:6001/app`,
    ],
  };
}

function djangoRoutes() {
  return {
    kind: 'django',
    me: `${API}/api/auth/me/`,
    users: `${API}/api/auth/users/`,
    convos: `${API}/api/chat/conversations/`,
    rooms: `${API}/api/chat/rooms/`,
    friend: `${API}/api/chat/friendship/`,
    // کانال‌ها معمولاً ws مسیر ثابت دارند
    wsCandidates: [`${API}`.replace(/^http/, 'ws') + `/ws/chat/`],
  };
}

export async function detectBackend(token) {
  // کش نتایج تا 5 دقیقه
  const cacheKey = 'backend_detect_cache_v1';
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { ts, value } = JSON.parse(cached);
      if (Date.now() - ts < 5 * 60 * 1000) return value;
    } catch {}
  }

  // 1) تلاش لارا
  const lr = await tryJson(`${API}/api/auth/me`, token);
  if (lr.ok && (lr.data?.id || lr.data?.name || lr.data?.email)) {
    const value = laravelRoutes();
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), value }));
    return value;
  }
  // 2) تلاش جنگو (اسلش پایانی)
  const dr = await tryJson(`${API}/api/auth/me/`, token);
  if (dr.ok && (dr.data?.id || dr.data?.username || dr.data?.email)) {
    const value = djangoRoutes();
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), value }));
    return value;
  }

  // اگر هیچ‌کدام پاسخ ندادند، بر اساس هیوریستیک: اگر /chatMeetUp/... کار کند لاراول
  const roomsLaravelProbe = await tryJson(
    `${API}/chatMeetUp/chatrooms/`,
    token,
  );
  if (roomsLaravelProbe.ok && Array.isArray(roomsLaravelProbe.data)) {
    const value = laravelRoutes();
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), value }));
    return value;
  }

  // پیش‌فرض: جنگو
  const value = djangoRoutes();
  localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), value }));
  return value;
}
