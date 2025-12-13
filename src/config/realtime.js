// src/config/realtime.js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY;
const PUSHER_CLUSTER =
  import.meta.env?.VITE_PUSHER_CLUSTER ||
  process.env.REACT_APP_PUSHER_CLUSTER ||
  ''; // اگر خالی بماند، Echo را نمی‌سازیم

Pusher.logToConsole = false;

export const echo =
  PUSHER_KEY && PUSHER_CLUSTER
    ? new Echo({
        broadcaster: 'pusher',
        key: PUSHER_KEY,
        cluster: PUSHER_CLUSTER, // ← خطای تو از همین نبودنش بود
        wsHost:
          import.meta.env?.VITE_PUSHER_HOST ||
          process.env.REACT_APP_PUSHER_HOST ||
          `ws-${PUSHER_CLUSTER}.pusher.com`,
        wsPort: Number(import.meta.env?.VITE_PUSHER_PORT || 6001),
        forceTLS: false,
        disableStats: true,
        enabledTransports: ['ws', 'wss'],
      })
    : null;
