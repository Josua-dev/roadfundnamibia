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
  // The backend now serves the frontend's built files directly (see
  // the static-serving block in server.js) -- everything runs from
  // one origin in both dev and production, so this is a genuinely
  // same-site cookie, not a cross-site one. That matters: this
  // project used to run as two separate Render services on
  // different *.onrender.com subdomains, which browsers treat as
  // fully separate sites (onrender.com is on the Public Suffix
  // List) -- that made the old SameSite=None cookie a real
  // third-party cookie, exactly the kind Chrome and Safari
  // increasingly block or restrict by default. Lax works now, and
  // is meaningfully safer than None on top of fixing that.
  sameSite: 'lax',
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
