import axios from 'axios';

// Ensure baseURL always points to the /api namespace
// If VITE_API_BASE_URL is "https://...app", we append "/api"
// If it already has "/api", we keep it.
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
  // Remove trailing slash if present
  const cleanUrl = envUrl.replace(/\/$/, '');
  // Append /api if not present
  if (!cleanUrl.endsWith('/api')) {
    return `${cleanUrl}/api`;
  }
  return cleanUrl;
};

const baseURL = getBaseUrl();

export const api = axios.create({
  baseURL,
  withCredentials: true, // Important for CORS cookies/sessions if used, though strict JWT usually doesn't need it, it doesn't hurt for consistency with backend 'credentials: true'
});

api.interceptors.request.use((config) => {
  // Safe parsing of localStorage
  try {
    const stored = localStorage.getItem('ims_user');
    if (stored) {
      const { token } = JSON.parse(stored);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.warn("Failed to parse user token", e);
    // Clear invalid token to preventing recurring errors
    localStorage.removeItem('ims_user');
  }
  return config;
});
