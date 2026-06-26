# RoadSafe Namibia
### Road Maintenance Reporting & Tracking System — operated by the Road Fund Administration (RFA)

A full-stack, production-grade government web platform built with **React + Vite + TypeScript** on the frontend and **Node.js + Express + PostgreSQL** on the backend.

---

## Tech Stack

| Layer       | Technology |
|-------------|------------|
| Frontend    | React 18, Vite, TypeScript, Tailwind CSS |
| State       | React Query (TanStack), React Context |
| UI/UX       | Framer Motion, Lucide Icons, Recharts |
| Map         | Leaflet.js + React-Leaflet |
| Backend     | Node.js, Express.js, REST API |
| Database    | PostgreSQL (e.g. [Neon](https://neon.com)), `pg` |
| Auth        | JWT, bcryptjs |
| Upload      | Multer |
| Dev Tools   | Nodemon, Vite HMR |

---

## Quick Setup (local development)

### Prerequisites
- A PostgreSQL database — easiest is a free [Neon](https://neon.com) project (no install, no credit card), or a local Postgres install if you'd rather run everything offline
- Node.js 18+ installed (https://nodejs.org/)
- VS Code (or any editor)

---

### Step 1 — Get a Postgres connection string

**Your Supabase project is already set up** — I created it for you via the Supabase connector:
- Project name: `roadfund`, region: Frankfurt (`eu-central-1`)
- Schema applied, demo data seeded, RLS locked down on every table (see "A note on security" below)

To get the connection string for your `.env`:
1. Go to https://supabase.com/dashboard → your `roadfund` project → **Project Settings → Database**
2. Under **Connection string**, choose **Direct connection** (this app keeps a persistent connection pool, so the direct connection — not the transaction pooler — is the right one)
3. If a password isn't shown, click **Reset database password** to generate one (Supabase only shows it once)
4. Copy the resulting URI — looks like `postgresql://postgres:[YOUR-PASSWORD]@db.nffztkzuviafssjgtchk.supabase.co:5432/postgres`

(Don't have Supabase, or want a different provider instead? Any standard Postgres connection string works here — [Neon](https://neon.com) is a solid free alternative. Just create a project there, point `DATABASE_URL` at it, and run `npm run setup -- --seed` from Step 2 below.)

#### A note on security
Every table in this app's Supabase project has Row Level Security **enabled with zero policies**. That's intentional: this backend talks to Postgres directly (not through Supabase's auto-generated REST API), so RLS policies don't apply to it — but leaving RLS off would have left the `users` table (password hashes included) readable by anyone who got hold of your project's anon key. Enabling it with no policies fully closes that off at zero cost to the app.

---

### Step 2 — Point the backend at it

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env` and paste your connection string into `DATABASE_URL`. Since the `roadfund` Supabase project already has the schema and demo data loaded, that's all you need — skip straight to Step 3.

> Setting up a *different* Postgres database instead (Neon, local Postgres, a second Supabase project)? Run `npm run setup -- --seed` to apply `database/schema.sql` + `database/seed.sql` to it (drop `--seed` for an empty schema with no demo data).

---

### Step 3 — Backend Setup

```bash
# still inside backend/, with DATABASE_URL set in .env from Step 2
npm run dev
```

You should see:
```
Road Fund API  ->  http://localhost:5000
PostgreSQL connected successfully
```

> **Signup verification emails:** new accounts get a 6-digit code by email (via [Resend](https://resend.com), free — 3,000 emails/month, no card) before they can log in. Without `RESEND_API_KEY` set, codes just print to your terminal instead of emailing anyone — handy for local dev, but you'll want a real key for anyone other than you to actually sign up. To set it up:
> 1. Sign up at resend.com (free, no card)
> 2. Dashboard → API Keys → Create API Key → copy it
> 3. Add `RESEND_API_KEY=re_...` to `backend/.env` (and to the backend service's environment variables on Render for production)
>
> The default sender (`onboarding@resend.dev`) works immediately with no setup. If you want emails to come from your own domain instead, verify it in Resend's dashboard, then set `EMAIL_FROM` to match.

---

### Step 4 — Frontend Setup

```bash
# Open a NEW terminal tab
cd frontend

# Install all dependencies
npm install

# Start Vite dev server
npm run dev
```

Frontend runs at: **http://localhost:5173**

(No `.env` needed for local dev — Vite's proxy already forwards `/api` to `http://localhost:5000`, see `vite.config.ts`.)

---

### Step 5 — Open the App

Navigate to **http://localhost:5173** in your browser.

---

## Demo Login Credentials

All accounts use password: **`Password123!`**

| Role                | Email                    | Access |
|---------------------|--------------------------|--------|
| **Administrator**   | admin@roadfund.na        | Full system access |
| **Inspector**       | inspector@roadfund.na    | Verify & review reports |
| **Maint. Officer**  | officer@roadfund.na      | Update repair progress |
| **Citizen**         | citizen@roadfund.na      | Submit & track reports |

> The login page has **Quick Demo Access** buttons for one-click login.

---

## Project Structure

```
roadfund/
├── backend/
│   ├── config/
│   │   └── database.js          # PostgreSQL connection pool
│   ├── controllers/
│   │   ├── authController.js    # Login, register, profile
│   │   ├── reportsController.js # CRUD + map data
│   │   ├── maintenanceController.js
│   │   ├── analyticsController.js
│   │   ├── usersController.js
│   │   └── notificationsController.js
│   ├── middleware/
│   │   ├── auth.js              # JWT + role guards
│   │   └── upload.js            # Multer file handler
│   ├── routes/
│   │   ├── auth.js
│   │   ├── reports.js
│   │   ├── maintenance.js
│   │   ├── users.js
│   │   ├── analytics.js
│   │   ├── notifications.js
│   │   └── regions.js
│   ├── scripts/
│   │   └── setupDb.js           # npm run setup -- runs schema.sql (+ seed.sql)
│   ├── utils/
│   │   └── sqlHelpers.js        # buildSetClause() for dynamic UPDATEs
│   ├── uploads/                 # Uploaded images stored here (local disk — see note below)
│   ├── .env.example
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/index.tsx # Badge, StatCard, Table, Modal, etc.
│   │   │   └── layout/
│   │   │       ├── PublicLayout.tsx
│   │   │       └── DashboardLayout.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── ReportDetail.tsx
│   │   │   ├── MapView.tsx
│   │   │   ├── Analytics.tsx
│   │   │   ├── NotificationsPage.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── auth/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   └── RegisterPage.tsx
│   │   │   ├── citizen/
│   │   │   │   ├── CitizenDashboard.tsx
│   │   │   │   ├── SubmitReport.tsx
│   │   │   │   └── MyReports.tsx
│   │   │   ├── inspector/
│   │   │   │   └── InspectorDashboard.tsx
│   │   │   ├── maintenance/
│   │   │   │   └── MaintenanceDashboard.tsx
│   │   │   └── admin/
│   │   │       ├── AdminDashboard.tsx
│   │   │       ├── AdminReports.tsx
│   │   │       └── AdminUsers.tsx
│   │   ├── types/index.ts
│   │   ├── utils/
│   │   │   ├── api.ts           # Axios instance
│   │   │   └── helpers.ts       # Formatters, badge configs
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
└── database/
    ├── schema.sql               # All CREATE TABLE statements
    └── seed.sql                 # Sample data
```

---

## Database Tables

| Table               | Purpose |
|---------------------|---------|
| `users`             | All user accounts with roles |
| `regions`           | 14 Namibian regions |
| `reports`           | Road issue reports |
| `maintenance_tasks` | Repair assignments |
| `attachments`       | Uploaded images per report |
| `status_history`    | Full audit trail of status changes |
| `notifications`     | Per-user notification inbox |
| `inspection_reports`| Inspector findings |
| `audit_logs`        | System-wide action logging |
| `report_sequences`  | Per-year counter backing race-condition-safe report numbers |

---

## REST API Endpoints

### Auth
| Method | Endpoint             | Description |
|--------|----------------------|-------------|
| POST   | /api/auth/register   | Create citizen account (sends a 6-digit verification code by email) |
| POST   | /api/auth/verify-email | Confirm the code, activates the account, returns a JWT |
| POST   | /api/auth/resend-verification | Request a new code (60s cooldown) |
| POST   | /api/auth/login      | JWT login (blocked until email is verified) |
| GET    | /api/auth/profile    | Get own profile |
| PUT    | /api/auth/profile    | Update profile |
| PUT    | /api/auth/change-password | Change password |

### Reports
| Method | Endpoint                | Description |
|--------|-------------------------|-------------|
| GET    | /api/reports            | List reports (with filters) |
| GET    | /api/reports/map        | Map markers data |
| GET    | /api/reports/:id        | Full report detail |
| POST   | /api/reports            | Submit new report |
| PATCH  | /api/reports/:id/status | Update status (staff) |
| DELETE | /api/reports/:id        | Delete report |

### Maintenance
| Method | Endpoint             | Description |
|--------|----------------------|-------------|
| GET    | /api/maintenance     | List tasks |
| GET    | /api/maintenance/:id | Task detail |
| POST   | /api/maintenance     | Create task (admin) |
| PATCH  | /api/maintenance/:id | Update progress |

### Analytics
| Method | Endpoint                        | |
|--------|---------------------------------|-|
| GET    | /api/analytics/overview         | Admin stats |
| GET    | /api/analytics/by-region        | Per region |
| GET    | /api/analytics/monthly-trend    | 12 months |
| GET    | /api/analytics/by-severity      | Severity split |
| GET    | /api/analytics/by-status        | Status split |
| GET    | /api/analytics/by-issue-type    | Type split |
| GET    | /api/analytics/citizen-stats    | Personal stats |

---

## User Roles & Permissions

| Feature                    | Citizen | Inspector | Officer | Admin |
|----------------------------|:-------:|:---------:|:-------:|:-----:|
| Submit report              | Yes     | Yes        | Yes     | Yes    |
| View own reports           | Yes     | Yes        | Yes     | Yes    |
| View all reports           | No      | Yes        | Yes     | Yes    |
| Change report status       | No      | Yes        | Yes     | Yes    |
| View analytics             | No      | Yes        | Yes     | Yes    |
| Manage maintenance tasks   | No      | No        | Yes     | Yes    |
| Create maintenance tasks   | No      | No        | No      | Yes    |
| Manage users               | No      | No        | No      | Yes    |

---

## Deploying to Production

This deploys for **$0/month** using free tiers: [Supabase](https://supabase.com) for the database (already set up — see below), [Render](https://render.com) for hosting both the backend and frontend.

> Render's free web services sleep after 15 minutes of inactivity and take ~30s to wake back up on the next request. Fine for a demo or low-traffic deployment; upgrade to a paid Render plan later if you need it always-on.

### 1. Push this project to GitHub
Render's Blueprint deploys (used below) need a Git repo to deploy from.

### 2. Database — already done
A Supabase project named `roadfund` (Frankfurt region) already has the schema applied and demo data seeded. Just grab its connection string:
1. https://supabase.com/dashboard → `roadfund` project → **Project Settings → Database**
2. Under **Connection string**, copy the **Direct connection** URI (reset the database password first if one isn't shown — Supabase only displays it once)

### 3. Deploy to Render with the included Blueprint
This repo includes a `render.yaml` at the project root that defines both services (backend web service + frontend static site) in one shot.

1. In the Render Dashboard: **New → Blueprint**, connect your GitHub repo
2. Render reads `render.yaml` and shows you both services it's about to create
3. When prompted, paste your **Supabase connection string** in for the backend's `DATABASE_URL` (the Blueprint marks it `sync: false` so it's never committed to your repo)
4. Click **Deploy Blueprint**

Render builds and deploys both services. The blueprint pre-wires `VITE_API_URL` (frontend → backend) and `ALLOWED_ORIGINS` (backend's CORS allowlist → frontend) based on Render's predictable `https://<service-name>.onrender.com` URL pattern. If Render had to rename either service (e.g. the name was already taken in your account), open that service's **Environment** tab, fix the URL, and trigger a manual redeploy.

### 4. Verify
Visit your frontend's `.onrender.com` URL and log in with one of the [demo accounts](#demo-login-credentials).

### A note on file uploads
Render's free web services have an **ephemeral filesystem** — anything written to `backend/uploads/` (photos attached to reports) is wiped on every deploy and restart. This mirrors how most free-tier PaaS hosting works (Heroku, Railway, Fly.io free tiers behave the same way). It's fine for a demo, but for real persistent file storage you'd want object storage like Cloudflare R2, Backblaze B2, AWS S3, or Supabase Storage itself — happy to wire that up if/when you need it.

---

## Troubleshooting

**PostgreSQL connection failed**
- Double-check `DATABASE_URL` in `backend/.env` — copy it fresh from Neon/your provider, typos here are the #1 cause
- Neon (and most managed Postgres) require SSL — the app requests it automatically unless you set `PGSSL=disable`
- For local Postgres: confirm the server is running (`pg_isready` or `sudo service postgresql status`) and that the database named in your connection string actually exists

**Port 5000 already in use**
- Change `PORT=5001` in `backend/.env`
- Update `vite.config.ts` proxy target to match

**npm install fails**
- Use Node.js 18+: `node -v`
- Delete `node_modules` and `package-lock.json`, then retry

**Map not loading**
- The Leaflet CSS is loaded via CDN in `index.html`
- Ensure internet connection for tile loading

**Frontend can't reach the backend after deploying**
- Check that `VITE_API_URL` (frontend env var) points at your backend's real URL + `/api`, and that `ALLOWED_ORIGINS` (backend env var) matches your frontend's real URL exactly (including `https://`, no trailing slash)
- Static site env vars are baked in at **build time** — after changing one, you need to trigger a redeploy, not just restart

---

## Running Both Servers

Keep **two terminal tabs** open in VS Code:

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend  
cd frontend && npm run dev
```

---

*Built for Road Fund Administration Namibia · Government Infrastructure Division*
