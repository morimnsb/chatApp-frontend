// src/reverb/echo.js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js'; // 👈 ضروری برای Reverb
window.Pusher = Pusher; // 👈 global کردن Pusher برای Echo

const API_BASE =
  process.env.REACT_APP_API_BASE_LARAVEL || 'http://localhost:8000/api';

export function makeEcho(bearerToken) {
  if (!bearerToken) return null;

  const key = process.env.REACT_APP_REVERB_APP_KEY || 'app-key';
  const host = process.env.REACT_APP_REVERB_HOST || '127.0.0.1';
  const port = Number(process.env.REACT_APP_REVERB_PORT || 8080);
  const useTLS = String(process.env.REACT_APP_REVERB_TLS || '0') === '1';

  return new Echo({
    broadcaster: 'reverb',
    key,
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS: useTLS,
    enabledTransports: ['ws', 'wss'],

    // می‌توانی از authorizer سفارشی استفاده کنی یا authEndpoint استاندارد:
    authorizer: (channel) => ({
      authorize: (socketId, callback) => {
        fetch(`${API_BASE}/broadcasting/auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearerToken}`,
          },
          body: JSON.stringify({
            channel_name: channel.name,
            socket_id: socketId,
          }),
        })
          .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (res.ok) return callback(null, body);
            return callback(true, body || { error: `HTTP ${res.status}` });
          })
          .catch((err) => callback(true, err));
      },
    }),
  });
}
