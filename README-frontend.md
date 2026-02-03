# ChatApp Frontend (React + Vite)

Frontend for ChatApp built with React, Vite, Redux, and Laravel Echo.

## Requirements
- Node.js >= 18

## Installation
```powershell
npm install
```

## Environment (.env.local)
```env
VITE_API_URL=http://127.0.0.1:8000
VITE_PUSHER_KEY=local
VITE_PUSHER_HOST=127.0.0.1
VITE_PUSHER_PORT=8080
VITE_PUSHER_TLS=false
VITE_PUSHER_AUTH_ENDPOINT=http://127.0.0.1:8000/api/broadcasting/auth
```

## Run Frontend
```powershell
npm run dev
```

## Realtime
- Presence: `presence-global`
- Private user channel: `private-user.{id}`
