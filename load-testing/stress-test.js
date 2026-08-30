import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const rateLimitHits = new Counter('rate_limit_429_hits');
const successfulRequests = new Counter('successful_2xx_requests');

export const options = {
  stages: [
    { duration: '15s', target: 50 },  // Step 1: Ramp to normal load
    { duration: '30s', target: 150 }, // Step 2: Push to high load
    { duration: '20s', target: 250 }, // Step 3: Extreme traffic spike (trigger HPA & rate limiter)
    { duration: '15s', target: 0 },   // Step 4: Cooldown & recovery
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'], // P99 under 500ms even under heavy spike
  },
};

const SHORTENER_URL = __ENV.SHORTENER_URL || 'http://localhost:3001';

export default function () {
  const isCreation = Math.random() < 0.3; // 30% write traffic to trigger rate limiter

  if (isCreation) {
    const payload = JSON.stringify({
      url: `https://stress-test.internal/resource/${Math.floor(Math.random() * 100000)}`,
    });
    const res = http.post(`${SHORTENER_URL}/api/shorten`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status === 429) {
      rateLimitHits.add(1);
    } else if (res.status === 201) {
      successfulRequests.add(1);
    }

    check(res, {
      'status is 201 or 429': (r) => r.status === 201 || r.status === 429,
    });
  } else {
    // 70% high-throughput cached lookup
    const res = http.get(`${SHORTENER_URL}/FKPh333`, { redirects: 0 });
    if (res.status === 302 || res.status === 200) {
      successfulRequests.add(1);
    }

    check(res, {
      'redirect is responsive': (r) => r.status === 302 || r.status === 404,
    });
  }

  sleep(0.05); // High request frequency (50ms)
}
