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
  // The JWT lives in an httpOnly cookie set by the server (see
  // backend/utils/authCookie.js), not in localStorage/JS-readable
  // storage. withCredentials makes the browser include that cookie
  // on every request automatically -- no token ever needs to be
  // read or attached here, which is the whole point: a script
  // running on this page (including an injected XSS payload)
  // literally cannot access the token's value.
  withCredentials: true,
});

// Endpoints that are genuinely public -- a 401 from these isn't a
// session expiry (a public page has no session to expire), it's just
// that endpoint's own business logic (e.g. login with a wrong password).
const PUBLIC_PATHS = ['/public/', '/auth/login', '/auth/register', '/auth/verify-email', '/auth/resend-verification'];
// AuthContext calls this on EVERY page load (including public pages)
// to silently check "is there a valid session?" -- for any anonymous
// visitor, a 401 here is the normal, expected answer, not a sign of a
// dead session. AuthContext's own .catch() already handles that
// outcome gracefully (sets user to null); the interceptor doesn't
// need to react to it, and definitely shouldn't force-redirect.
const NO_REDIRECT_PATHS = [...PUBLIC_PATHS, '/auth/profile'];
const shouldSkipRedirect = (url?: string) => !!url && NO_REDIRECT_PATHS.some(p => url.includes(p));

// ── Response Interceptor: handle auth errors ──────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only a 401 from a genuinely protected endpoint, outside the
    // silent-bootstrap-check exemption above, means "your session is
    // invalid, force a fresh login." The cookie itself is cleared
    // server-side (see POST /auth/logout) -- there's nothing for the
    // client to clean up in storage anymore.
    if (error.response?.status === 401 && !shouldSkipRedirect(error.config?.url)) {
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
