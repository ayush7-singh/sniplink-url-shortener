const client = require('prom-client');

const register = new client.Registry();

// Collect default runtime and NodeJS process metrics
client.collectDefaultMetrics({
  register,
  prefix: 'sniplink_shortener_',
});

// Custom HTTP Metrics (RED Method)
const httpRequestsTotal = new client.Counter({
  name: 'sniplink_shortener_http_requests_total',
  help: 'Total number of HTTP requests processed by shortener service',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'sniplink_shortener_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// Custom Business Metrics
const urlsShortenedTotal = new client.Counter({
  name: 'sniplink_urls_shortened_total',
  help: 'Total number of shortened URLs generated',
  registers: [register],
});

const urlRedirectsTotal = new client.Counter({
  name: 'sniplink_url_redirects_total',
  help: 'Total number of URL redirects served',
  labelNames: ['cache_hit'],
  registers: [register],
});

const eventsPublishedTotal = new client.Counter({
  name: 'sniplink_events_published_total',
  help: 'Total number of click events published to message broker',
  registers: [register],
});

/**
 * Express middleware to track HTTP request metrics
 */
function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics' || req.path === '/healthz' || req.path === '/readyz') {
    return next();
  }

  const start = process.hrtime();

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds + nanoseconds / 1e9;
    const route = req.route ? req.baseUrl + req.route.path : req.path;

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });

    httpRequestDurationSeconds.observe(
      {
        method: req.method,
        route,
        status_code: res.statusCode,
      },
      duration
    );
  });

  next();
}

module.exports = {
  register,
  metricsMiddleware,
  urlsShortenedTotal,
  urlRedirectsTotal,
  eventsPublishedTotal,
};
