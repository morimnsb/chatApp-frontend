// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },

  server: {
    proxy: {
      '/sanctum': { target: 'http://localhost:8000', changeOrigin: true },
      '/broadcasting': { target: 'http://localhost:8000', changeOrigin: true },

      '/auth/login': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/auth\/login$/, '/login'),
      },
      '/auth/logout': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/auth\/logout$/, '/logout'),
      },
      '/auth/user': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/auth\/user$/, '/user'),
      },

      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // 1) React core ??? ? ??? ?????? (???? ??? ???? ??? cycle)
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/') ||
            id.includes('/node_modules/use-sync-external-store/')
          ) {
            return 'react';
          }

          // 2) Router ???
          if (id.includes('/node_modules/react-router/') || id.includes('/node_modules/react-router-dom/')) {
            return 'react-router';
          }

          // 3) Redux ecosystem ??? (??? ?? ?? ??? ????)
          if (
            id.includes('/node_modules/@reduxjs/toolkit/') ||
            id.includes('/node_modules/redux/') ||
            id.includes('/node_modules/react-redux/') ||
            id.includes('/node_modules/reselect/') ||
            id.includes('/node_modules/immer/')
          ) {
            return 'redux';
          }

          // 4) Realtime ???
          if (id.includes('/node_modules/pusher-js/') || id.includes('/node_modules/laravel-echo/')) {
            return 'realtime';
          }

          // 5) UI ???
          if (id.includes('/node_modules/react-toastify/') || id.includes('/node_modules/react-bootstrap/')) {
            return 'ui';
          }

          // 6) axios ???
          if (id.includes('/node_modules/axios/')) {
            return 'axios';
          }

          // 7) ???? vendor
          return 'vendor';
        },
      },
    },
  },
});
