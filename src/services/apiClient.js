// src/services/apiClient.js
import axios from 'axios';

const ABSOLUTE_RE = /^(?:https?:)?\/\//i;
const isAbsoluteUrl = (u) => ABSOLUTE_RE.test(String(u || ''));

function buildFullUrl(config) {
  const base = String(config.baseURL || '').replace(/\/+$/, '');
  const url = String(config.url || '');

  // اگر absolute است، همون رو برگردون
  if (isAbsoluteUrl(url)) return url;

  // اگر relative است، با baseURL join کن
  const path = url.replace(/^\/+/, '');
  return base ? `${base}/${path}` : `/${path}`;
}

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000', // یا localhost فرقی نداره
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

apiClient.interceptors.request.use(
  (config) => {
    const full = buildFullUrl(config);
    const hasAuth = Boolean(config.headers?.Authorization);

    console.log('[apiClient] ->', {
      method: (config.method || 'get').toLowerCase(),
      url: full,
      hasAuth,
    });

    // ✅ خیلی مهم: هیچ تغییری روی config.url نده
    return config;
  },
  (err) => Promise.reject(err),
);

apiClient.interceptors.response.use(
  (res) => {
    console.log('[apiClient] <-', { status: res.status, url: buildFullUrl(res.config) });
    return res;
  },
  (err) => {
    console.log('[apiClient] xx', {
      status: err?.response?.status,
      url: buildFullUrl(err?.config || {}),
      data: err?.response?.data,
    });
    return Promise.reject(err);
  },
);

export default apiClient;
