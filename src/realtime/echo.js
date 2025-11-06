import Echo from 'laravel-echo';

export function makeEcho(bearerToken) {
  const wsHost = import.meta.env.VITE_REVERB_HOST || '127.0.0.1';
  const wsPort = Number(import.meta.env.VITE_REVERB_PORT || 8080);
  const key = import.meta.env.VITE_REVERB_APP_KEY || 'localkey';
  const scheme = import.meta.env.VITE_REVERB_SCHEME || 'http';

  return new Echo({
    broadcaster: 'reverb',
    key,
    wsHost,
    wsPort,
    wssPort: wsPort,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],

    // مهم: این روت را در Provider با bearer.auth باز کردیم
    authEndpoint: 'http://localhost:8000/broadcasting/auth',
    auth: {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    },
  });
}
