const { Pool, Client } = require('pg');
const config = require('./config');

// Pool connecting directly to the target urlshortener database
const poolConfig = config.databaseUrl
  ? { connectionString: config.databaseUrl }
  : {
      user: config.pg.user,
      password: config.pg.password,
      host: config.pg.host,
      port: config.pg.port,
      database: config.pg.database,
    };

const pool = new Pool(poolConfig);

/**
 * Ensure the urlshortener database exists, then initialize the tables.
 */
async function initDb() {
  // 1. Connect to default 'postgres' database to check/create target database if needed
  if (!config.databaseUrl) {
    const rootClient = new Client({
      user: config.pg.user,
      password: config.pg.password,
      host: config.pg.host,
      port: config.pg.port,
      database: 'postgres',
    });

    try {
      await rootClient.connect();
      const dbCheck = await rootClient.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [config.pg.database]
      );

      if (dbCheck.rows.length === 0) {
        console.log(`[DB] Database "${config.pg.database}" does not exist, creating...`);
        await rootClient.query(`CREATE DATABASE "${config.pg.database}"`);
        console.log(`[DB] Database "${config.pg.database}" created successfully.`);
      }
    } catch (err) {
      console.warn('[DB] Notice while checking database existence:', err.message);
    } finally {
      try {
        await rootClient.end();
      } catch {}
    }
  }

  // 2. Connect to the urlshortener database and create tables
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS urls (
        id            SERIAL PRIMARY KEY,
        short_code    VARCHAR(10) UNIQUE NOT NULL,
        original_url  TEXT NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        click_count   INTEGER DEFAULT 0
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_urls_short_code ON urls(short_code);
    `);
    console.log('[DB] PostgreSQL connected, schema initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb };
