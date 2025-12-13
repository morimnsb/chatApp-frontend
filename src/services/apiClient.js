// src/services/apiClient.js (نمونه)
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false, // ✅ JWT
});

export default apiClient;
