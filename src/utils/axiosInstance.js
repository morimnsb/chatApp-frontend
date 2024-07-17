// utils/axiosInstance.js

import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://localhost:8000', // Replace with your Django backend URL
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include this if your backend requires credentials (e.g., cookies for CSRF)
});

export const setCsrfToken = (token) => {
  axiosInstance.defaults.headers.common['X-CSRFToken'] = token;
};

export default axiosInstance;
