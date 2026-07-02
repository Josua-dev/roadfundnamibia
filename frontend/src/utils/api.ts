import axios from 'axios';

// In dev, Vite's proxy forwards /api -> http://localhost:5000 (see vite.config.ts),
// so the relative path works as-is. In production the frontend and backend are
// usually deployed as two separate services (e.g. Render Static Site + Render
// Web Service), so VITE_API_URL must point at the deployed backend's full URL
// (set it in your hosting provider's environment variables at build time).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Endpoints that are genuinely public -- never send a token on these,
// and never treat a 401 from them as "your session expired" (a public
// page has no session to expire in the first place).
const PUBLIC_PATHS = ['/public/', '/auth/login', '/auth/register', '/auth/verify-email', '/auth/resend-verification'];
const isPublicPath = (url?: string) => !!url && PUBLIC_PATHS.some(p => url.includes(p));

// ── Request Interceptor: attach token (protected endpoints only) ──
api.interceptors.request.use(
  (config) => {
    if (!isPublicPath(config.url)) {
      const token = localStorage.getItem('rf_token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor: handle auth errors ──────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 from a public endpoint isn't a session expiry -- it's
    // just that endpoint's own business logic (e.g. login with a
    // wrong password). Only a 401 from a genuinely protected
    // endpoint means "your token is invalid, force a fresh login."
    if (error.response?.status === 401 && !isPublicPath(error.config?.url)) {
      localStorage.removeItem('rf_token');
      localStorage.removeItem('rf_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
