-- ============================================================
-- Road Fund Administration Namibia
-- Database Schema (PostgreSQL)
-- ============================================================
-- Run this against your Postgres database, e.g.:
--   psql "$DATABASE_URL" -f database/schema.sql
-- (Neon/most managed Postgres providers create the database for
-- you when you create the project — there's no CREATE DATABASE step.)

-- ── Helper: auto-update `updated_at` on row UPDATE ─────────────
-- (Postgres has no "ON UPDATE CURRENT_TIMESTAMP" column option like
-- MySQL — a trigger is the standard way to get the same behavior.)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- REGIONS
-- ============================================================
CREATE TABLE regions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(10) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'citizen'
    CHECK (role IN ('citizen','inspector','maintenance_officer','admin')),
  region_id INT REFERENCES regions(id) ON DELETE SET NULL,
  phone VARCHAR(20),
  avatar_url VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  report_number VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  issue_type VARCHAR(30) NOT NULL
    CHECK (issue_type IN (
      'pothole','damaged_sign','broken_traffic_light',
      'flooded_road','cracked_road','road_blockage','other'
    )),
  severity VARCHAR(10) NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low','medium','high','critical')),
  status VARCHAR(20) NOT NULL DEFAULT 'reported'
    CHECK (status IN (
      'reported','under_review','verified',
      'assigned','in_progress','completed','rejected'
    )),
  region_id INT NOT NULL REFERENCES regions(id),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  address TEXT,
  reported_by INT NOT NULL REFERENCES users(id),
  assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
  progress_percent SMALLINT DEFAULT 0,
  rejection_reason TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_status ON reports (status);
CREATE INDEX idx_reports_severity ON reports (severity);
CREATE INDEX idx_reports_region ON reports (region_id);
CREATE INDEX idx_reports_reported_by ON reports (reported_by);

CREATE TRIGGER trg_reports_updated_at
BEFORE UPDATE ON reports
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- MAINTENANCE TASKS
-- ============================================================
CREATE TABLE maintenance_tasks (
  id SERIAL PRIMARY KEY,
  report_id INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  assigned_team VARCHAR(150),
  assigned_officer INT REFERENCES users(id) ON DELETE SET NULL,
  inspector_id INT REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','paused')),
  priority VARCHAR(10) DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  start_date DATE,
  estimated_completion DATE,
  actual_completion DATE,
  progress_percent SMALLINT DEFAULT 0,
  notes TEXT,
  cost_estimate DECIMAL(12,2),
  actual_cost DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_maintenance_tasks_updated_at
BEFORE UPDATE ON maintenance_tasks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ATTACHMENTS
-- ============================================================
CREATE TABLE attachments (
  id SERIAL PRIMARY KEY,
  report_id INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),
  -- 'reported' = citizen's original photo, 'completed' = officer's
  -- proof-of-repair photo. Powers the public before/after Impact page.
  stage VARCHAR(20) NOT NULL DEFAULT 'reported' CHECK (stage IN ('reported', 'completed')),
  uploaded_by INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- STATUS HISTORY (TIMELINE)
-- ============================================================
CREATE TABLE status_history (
  id SERIAL PRIMARY KEY,
  report_id INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by INT NOT NULL REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'info'
    CHECK (type IN ('status_update','assignment','alert','info','success')),
  report_id INT REFERENCES reports(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_read ON notifications (user_id, is_read);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs (user_id);

-- ============================================================
-- INSPECTION_REPORTS
-- ============================================================
CREATE TABLE inspection_reports (
  id SERIAL PRIMARY KEY,
  report_id INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  inspector_id INT NOT NULL REFERENCES users(id),
  findings TEXT,
  recommendation TEXT,
  verified BOOLEAN DEFAULT FALSE,
  inspection_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- EMAIL VERIFICATIONS (signup OTP codes)
-- ============================================================
CREATE TABLE email_verifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_verifications_user ON email_verifications (user_id);

-- ── Report number sequence (race-condition-safe counter) ──────
CREATE TABLE IF NOT EXISTS report_sequences (
  year     SMALLINT NOT NULL,
  last_seq INTEGER  NOT NULL DEFAULT 0,
  PRIMARY KEY (year)
);
