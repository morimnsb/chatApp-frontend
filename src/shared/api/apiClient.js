// src/services/apiClient.js
import axios from 'axios';

const ABSOLUTE_RE = /^(?:https?:)?\/\//i;
const isAbsoluteUrl = (u) => ABSOLUTE_RE.test(String(u || ''));

function buildFullUrl(config) {
  const base = String(config?.baseURL || '').replace(/\/+$/, '');
  const url = String(config?.url || '');

  if (isAbsoluteUrl(url)) return url;

  const path = url.replace(/^\/+/, '');
  return base ? `${base}/${path}` : `/${path}`;
}

const DEV = import.meta.env.DEV === true;
const DEBUG = DEV && String(import.meta.env.VITE_CHAT_DEBUG || '') === 'true';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

const isCanceled = (err) =>
  err?.code === 'ERR_CANCELED' ||
  err?.name === 'CanceledError' ||
  err?.message === 'canceled' ||
  axios.isCancel?.(err) === true;

apiClient.interceptors.request.use(
  (config) => {
    if (DEBUG) {
      console.log('[apiClient] ->', {
        method: (config.method || 'get').toUpperCase(),
        url: buildFullUrl(config),
        hasAuth: Boolean(config.headers?.Authorization),
      });
    }
    return config;
  },
  (err) => {
    if (!isCanceled(err)) {
      console.log('[apiClient] request error', {
        message: err?.message,
        code: err?.code,
      });
    }
    return Promise.reject(err);
  },
);

apiClient.interceptors.response.use(
  (res) => {
    if (DEBUG) {
      console.log('[apiClient] <-', { status: res.status, url: buildFullUrl(res.config) });
    }
    return res;
  },
  (err) => {
    // ✅ canceled = طبیعی (cleanup/StrictMode/retry) → اسپم نکن
    if (isCanceled(err)) return Promise.reject(err);

    console.log('[apiClient] xx', {
      message: err?.message,
      code: err?.code,
      status: err?.response?.status,
      url: buildFullUrl(err?.config || {}),
      data: err?.response?.data,
    });

    return Promise.reject(err);
  },
);

export default apiClient;
