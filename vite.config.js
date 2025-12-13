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

      // مجازی برای auth تا رفرش /login به سرور نرود
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
});
