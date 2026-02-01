// src/config/api.js
import axios from 'axios';

export const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_URL) ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000';

// نکته مهم: اینجا /api نمی‌گذاریم
export const axiosInstance = axios.create({
  baseURL: API_BASE.replace(/\/+$/, ''), // فقط origin/host
  withCredentials: true,
});

axiosInstance.interceptors.response.use(
  (r) => {
    console.debug('[HTTP OK]', r.config?.url, r.status);
    return r;
  },
  (e) => {
    console.error(
      '[HTTP ERR]',
      e.config?.url,
      e.response?.status,
      e.response?.data
    );
    return Promise.reject(e);
  }
);
