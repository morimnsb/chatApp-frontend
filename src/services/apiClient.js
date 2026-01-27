// src/services/apiClient.js
import axios from 'axios';

const apiClient = axios.create({
  // ✅ IMPORTANT: keep host consistent with endpoints (localhost vs 127.0.0.1)
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false, // JWT (Sanctum personal access token)
});

// ✅ optional: tiny debug when VITE_CHAT_DEBUG=true
const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';

if (DEBUG) {
  apiClient.interceptors.request.use((config) => {
    console.log('[apiClient] ->', {
      method: config.method,
      url: config.baseURL ? `${config.baseURL}${config.url}` : config.url,
      hasAuth: Boolean(config.headers?.Authorization),
    });
    return config;
  });

  apiClient.interceptors.response.use(
    (resp) => {
      console.log('[apiClient] <-', {
        status: resp.status,
        url: resp.config?.baseURL ? `${resp.config.baseURL}${resp.config.url}` : resp.config?.url,
      });
      return resp;
    },
    (err) => {
      console.log('[apiClient] xx', {
        status: err?.response?.status,
        url: err?.config?.baseURL ? `${err.config.baseURL}${err.config.url}` : err?.config?.url,
        data: err?.response?.data,
      });
      return Promise.reject(err);
    },
  );
}

export default apiClient;
