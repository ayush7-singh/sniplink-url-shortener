import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom business metrics
const linksCreated = new Counter('links_created');
const redirectRequests = new Counter('redirect_requests');
const redirectLatency = new Trend('redirect_duration_ms');

export const options = {
  stages: [
    { duration: '20s', target: 20 }, // Ramp up to 20 VUs
    { duration: '40s', target: 50 }, // Ramp up to 50 VUs and sustain
    { duration: '15s', target: 0 },  // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<150', 'p(99)<300'], // P95 < 150ms, P99 < 300ms
    redirect_duration_ms: ['p(95)<80'],           // Redis-cached redirects < 80ms
    http_req_failed: ['rate<0.05'],               // Allow occasional rate limit 429
  },
};

const SHORTENER_URL = __ENV.SHORTENER_URL || 'http://localhost:3001';
const ANALYTICS_URL = __ENV.ANALYTICS_URL || 'http://localhost:3002';

// Seeded active short codes to test cache hits
const POPULAR_CODES = ['demo123', 'k8slink', 'promlink', 'grafana1', 'cloudurl'];

export function setup() {
  // Pre-seed a test URL to ensure cache hits
  const payload = JSON.stringify({ url: 'https://github.com/grafana/k6' });
  const res = http.post(`${SHORTENER_URL}/api/shorten`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status === 201) {
    const data = JSON.parse(res.body);
    return { seedCode: data.shortCode };
  }
  return { seedCode: 'FKPh333' };
}

export default function (data) {
  const rand = Math.random();
  const testCode = data.seedCode || POPULAR_CODES[Math.floor(Math.random() * POPULAR_CODES.length)];

  if (rand < 0.80) {
    // ── 80% Traffic: Redirect Lookup (Hot Path) ──
    const start = Date.now();
    const res = http.get(`${SHORTENER_URL}/${testCode}`, { redirects: 0 });
    const duration = Date.now() - start;

    redirectRequests.add(1);
    redirectLatency.add(duration);

    check(res, {
      'redirect is 302 or 404': (r) => r.status === 302 || r.status === 404,
    });
  } else if (rand < 0.95) {
    // ── 15% Traffic: URL Shorten Creation (Write Path) ──
    const payload = JSON.stringify({
      url: `https://example.com/articles/${Math.floor(Math.random() * 10000)}`,
    });
    const res = http.post(`${SHORTENER_URL}/api/shorten`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status === 201) {
      linksCreated.add(1);
    }

    check(res, {
      'create status is 201 or 429': (r) => r.status === 201 || r.status === 429,
    });
  } else {
    // ── 5% Traffic: Analytics Queries (Read Path) ──
    const res = http.get(`${ANALYTICS_URL}/api/analytics/${testCode}`);
    check(res, {
      'analytics status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
  }

  // Realistic user think time between actions (100ms - 300ms)
  sleep(Math.random() * 0.2 + 0.1);
}
