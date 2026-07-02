/**
 * The JWT lives in an httpOnly cookie instead of being returned in the
 * response body / stored in localStorage. httpOnly means client-side
 * JavaScript (including an XSS payload, if one ever got injected) can
 * never read it -- DevTools' Application tab will show the cookie
 * exists, but not hand its value to a script. That's the actual
 * security property; the token isn't hidden from the browser, just
 * unreachable from JS running in the page.
 */
const COOKIE_NAME = 'rf_token';

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // HTTPS-only in prod; allows plain http on localhost dev
  // Frontend and backend are different origins (separate Render
  // services), so the cookie must be sent cross-site -- SameSite=None
  // is required for that, which in turn requires Secure in production
  // (browsers reject None cookies without Secure).
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches JWT_EXPIRES_IN default
  path: '/',
});

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}

module.exports = { COOKIE_NAME, setAuthCookie, clearAuthCookie };
