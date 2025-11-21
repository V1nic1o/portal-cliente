import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: Inyectar el token del usuario si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('client_token'); // Ojo: usamos 'client_token'
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;