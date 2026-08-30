const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;

const config = require('./config');
const { pool, initDb } = require('./db');
const { redis } = require('./cache');
const { connectQueue, closeQueue } = require('./queue');
const { register, metricsMiddleware } = require('./metrics');
const shortenRoutes = require('./routes/shorten');
const redirectRoutes = require('./routes/redirect');
const urlsRoutes = require('./routes/urls');

const app = express();

// ── Middleware ──
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('short'));
app.use(metricsMiddleware);

// ── Rate limiter (Redis-backed) on URL creation ──
const createLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  message: { error: 'Too many requests, please try again later' },
});

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
    await redis.ping();
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});

// ── Routes ──
app.use('/api/shorten', createLimiter, shortenRoutes);
app.use('/api/urls', urlsRoutes);

// Redirect routes must come last (catch-all /:code pattern)
app.use('/', redirectRoutes);

// ── Startup ──
async function start() {
  try {
    await initDb();
    await connectQueue();

    app.listen(config.port, () => {
      console.log(`[Shortener] Listening on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('[Shortener] Failed to start:', err);
    process.exit(1);
  }
}

// ── Graceful shutdown ──
async function shutdown() {
  console.log('\n[Shortener] Shutting down...');
  await closeQueue();
  await pool.end();
  redis.disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
