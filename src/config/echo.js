// src/config/echo.js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

Pusher.logToConsole = process.env.NODE_ENV !== 'production';

const key = import.meta.env.VITE_PUSHER_KEY;
const cluster = import.meta.env.VITE_PUSHER_CLUSTER;
const wsHost = import.meta.env.VITE_PUSHER_HOST || 'localhost';
const wsPort = Number(import.meta.env.VITE_PUSHER_PORT || 6001);

export const echo = new Echo({
  broadcaster: 'pusher',
  key,
  cluster, // ✅ این خط الزامیه
  wsHost,
  wsPort,
  forceTLS: false,
  encrypted: false,
  disableStats: true,
  enabledTransports: ['ws', 'wss'],
});
