const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const { pool, initDb } = require('./db');
const { startConsumer, closeConsumer } = require('./consumer');
const { register, metricsMiddleware } = require('./metrics');
const analyticsRoutes = require('./routes/analytics');

const app = express();

// ── Middleware ──
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('short'));
app.use(metricsMiddleware);

// ── Prometheus Metrics & Health Check Endpoints ──
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});
app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/readyz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});

// ── Routes ──
app.use('/api/analytics', analyticsRoutes);

// ── Startup ──
async function start() {
  try {
    await initDb();
    await startConsumer();

    app.listen(config.port, () => {
      console.log(`[Analytics] Listening on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('[Analytics] Failed to start:', err);
    process.exit(1);
  }
}

// ── Graceful shutdown ──
async function shutdown() {
  console.log('\n[Analytics] Shutting down...');
  await closeConsumer();
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
