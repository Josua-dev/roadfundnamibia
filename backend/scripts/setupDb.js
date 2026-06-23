/**
 * One-shot database setup: runs database/schema.sql, and optionally
 * database/seed.sql, against whatever DATABASE_URL (or DB_* vars)
 * your .env points at.
 *
 * Usage:
 *   npm run setup            # schema only
 *   npm run setup -- --seed  # schema + demo data
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'roadfund_system',
      port: process.env.DB_PORT || 5432,
    };

const run = async () => {
  const withSeed = process.argv.includes('--seed');
  const client = new Client(connectionConfig);

  try {
    await client.connect();
    console.log('Connected to database.');

    const schemaSql = fs.readFileSync(
      path.join(__dirname, '..', '..', 'database', 'schema.sql'),
      'utf8'
    );
    console.log('Applying schema.sql...');
    await client.query(schemaSql);
    console.log('Schema applied.');

    if (withSeed) {
      const seedSql = fs.readFileSync(
        path.join(__dirname, '..', '..', 'database', 'seed.sql'),
        'utf8'
      );
      console.log('Applying seed.sql...');
      await client.query(seedSql);
      console.log('Seed data inserted.');
    }

    console.log('\nDone.');
  } catch (error) {
    console.error('Setup failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
};

run();
