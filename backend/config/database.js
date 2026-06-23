const { Pool, types } = require('pg');
require('dotenv').config();

// ── Type parsing ────────────────────────────────────────────────
// node-postgres returns BIGINT (COUNT(*) etc.) and NUMERIC/DECIMAL
// columns as strings by default, to avoid silent precision loss.
// This app only ever deals with values well inside the safe JS
// number range, so we parse them back into real numbers — this
// matches how mysql2 behaved and keeps the rest of the codebase
// (pagination math, chart data, cost totals) working unchanged.
types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));   // BIGINT / COUNT(*)
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));   // NUMERIC / DECIMAL

// ── Connection ───────────────────────────────────────────────────
// Prefer a single DATABASE_URL (what Neon, Render, Supabase, Railway
// etc. all give you). Falls back to discrete DB_* vars for anyone
// running a local Postgres install instead.
const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      // Managed Postgres providers (Neon included) require SSL.
      // Set PGSSL=disable for a local Postgres that has no TLS set up.
      ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'roadfund_system',
      port: process.env.DB_PORT || 5432,
    };

const pool = new Pool({
  ...connectionConfig,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test connection on startup
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('PostgreSQL connected successfully');
    client.release();
  } catch (error) {
    console.error('PostgreSQL connection failed:', error.message);
    console.error('   Check DATABASE_URL (or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME) in your .env');
    process.exit(1);
  }
};

testConnection();

module.exports = pool;
