import axios from 'axios';

// Get base URL from environment or fallback to localhost
let envUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Auto-fix: Ensure the URL always ends with /api even if configured without it on Render
envUrl = envUrl.trim().replace(/\/+$/, ''); // remove trailing slashes
if (!envUrl.endsWith('/api')) {
  envUrl = `${envUrl}/api`;
}

export const API_BASE_URL = envUrl;

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

// Attach JWT token from localStorage for cross-domain requests on Render
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
