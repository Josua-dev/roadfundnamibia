const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path       = require('path');
require('dotenv').config();

// ── Route imports ───────────────────────────────────────────
const authRoutes         = require('./routes/auth');
const reportRoutes       = require('./routes/reports');
const maintenanceRoutes  = require('./routes/maintenance');
const userRoutes         = require('./routes/users');
const analyticsRoutes    = require('./routes/analytics');
const notificationRoutes = require('./routes/notifications');
const regionRoutes       = require('./routes/regions');
const uploadRoutes       = require('./routes/uploads');   // secure upload serving
const auditRoutes        = require('./routes/audit');
const publicRoutes       = require('./routes/public');

const app = express();

// Render (and most other hosting providers) terminate TLS at their
// load balancer and forward the request to the app over HTTP, adding
// the original client IP in the X-Forwarded-For header. Without this
// setting, express-rate-limit sees the load balancer's internal IP as
// the client address -- so everyone on the internet shares the same
// rate-limit bucket, and the library also emits the
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR warning you saw in the logs.
// Setting trust proxy to 1 tells Express to trust the first proxy in
// the chain (Render's load balancer) and read the real IP from the
// X-Forwarded-For header.
app.set('trust proxy', 1);

// ── Security headers (helmet) ────────────────────────────────
// This CSP now also governs the frontend's own HTML (see the static
// serving block near the bottom of this file) -- previously it only
// ever applied to this server's own JSON API responses, since the
// frontend was served entirely separately by Render's static
// hosting. Every external resource the frontend actually loads has
// to be explicitly allowed here or the browser will silently block
// it: Unsplash photos (hero slideshows), CARTO map tiles (Leaflet),
// unpkg's Leaflet stylesheet, and Google Fonts.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://unpkg.com', 'https://fonts.googleapis.com'],
      imgSrc:      ["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://*.basemaps.cartocdn.com'],
      connectSrc:  ["'self'"],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      objectSrc:   ["'none'"],
      frameSrc:    ["'none'"],
    },
  },
}));

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate limiting ─────────────────────────────────────────────
// Strict limit for auth endpoints (brute-force protection).
// GET /auth/profile is exempted below: it's a silent "is there a
// valid session?" check the frontend fires on EVERY page load (see
// AuthContext), not a login attempt -- it used to share this budget,
// which meant just having a few tabs open could exhaust 10 requests
// per 15 minutes before a real login attempt ever happened, showing
// "too many attempts" to someone who'd never actually tried to log
// in. It gets apiLimiter's much higher ceiling instead, further down.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' && req.path === '/profile',
});

// General API limit (generous — for dashboard polling etc.)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,    // 1 minute
  max: 200,
  message: { success: false, message: 'Rate limit exceeded. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});

// Report submission limit (prevent spam)
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 20,
  message: { success: false, message: 'Report submission limit reached. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth',           authLimiter);
app.use('/api',                apiLimiter);
app.use('/api/reports', (req, res, next) => {
  if (req.method === 'POST') return reportLimiter(req, res, next);
  next();
});

// ── Body parsing (tight limits — files go through Multer) ─────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ── Serve uploads securely via authenticated route ────────────
// Raw static /uploads is removed — access is gated by auth middleware
app.use('/api/uploads', uploadRoutes);

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/maintenance',   maintenanceRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/regions',       regionRoutes);
app.use('/api/audit-logs',    auditRoutes);
app.use('/api/public',        publicRoutes);

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Road Fund Administration API is running',
    timestamp: new Date().toISOString(),
    version: '1.1.0',
  });
});

// ── API 404 ──────────────────────────────────────────────────
// Scoped to /api/* specifically, and registered before the frontend
// static/catch-all block below -- an unmatched API call must still
// get a clean JSON 404, not the frontend's index.html.
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Serve the frontend (single-origin deployment) ──────────────
// This server now serves the built React app directly, instead of
// the frontend being deployed as a separate Render static site on
// its own subdomain. That split used to make the auth cookie a
// genuinely cross-site (third-party) cookie -- onrender.com is on
// the Public Suffix List, so two *.onrender.com services are
// treated as entirely separate sites by the browser, and browsers
// increasingly block or restrict exactly that kind of cookie.
// Serving both from one origin eliminates that failure mode
// structurally rather than working around it.
//
// Guarded by fs.existsSync so local development is unaffected: in
// dev the frontend runs as its own Vite dev server on port 5173
// (see frontend/vite.config.ts's proxy), and frontend/dist won't
// exist unless someone has explicitly run a production build.
const fs = require('fs');
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA catch-all: any non-API route (e.g. /dashboard/reports/5)
  // gets index.html, and React Router takes over from there.
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
  console.log('  Serving frontend from', frontendDist);
} else {
  console.log('  frontend/dist not found -- running API-only (expected in local dev)');
}

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  // Don't leak stack traces to clients in production
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} →`, err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('\n  Road Fund API  ->  http://localhost:' + PORT);
  console.log('  Helmet, rate-limiting, secure uploads: active');
  console.log('  Environment:', process.env.NODE_ENV || 'development', '\n');
});

module.exports = app;
