const { Pool } = require('pg');
const config = require('./config');

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
 * Initialize the analytics database schema.
 * Creates the click_events table.
 */
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS click_events (
        id          SERIAL PRIMARY KEY,
        short_code  VARCHAR(10) NOT NULL,
        clicked_at  TIMESTAMPTZ DEFAULT NOW(),
        referrer    TEXT,
        user_agent  TEXT,
        ip_address  VARCHAR(45)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_click_events_code ON click_events(short_code);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_click_events_time ON click_events(clicked_at);
    `);
    console.log('[DB] PostgreSQL connected, analytics schema initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb };
