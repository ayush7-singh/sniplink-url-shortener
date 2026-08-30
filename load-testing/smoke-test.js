import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  vus: 1,
  duration: '15s',
  thresholds: {
    http_req_duration: ['p(95)<100'], // 95% of requests must complete below 100ms
    errors: ['rate<0.01'],            // Error rate must be < 1%
  },
};

const SHORTENER_URL = __ENV.SHORTENER_URL || 'http://localhost:3001';
const ANALYTICS_URL = __ENV.ANALYTICS_URL || 'http://localhost:3002';

export default function () {
  // 1. Health Checks
  const healthRes = http.get(`${SHORTENER_URL}/healthz`);
  check(healthRes, {
    'shortener healthz is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  const analyticsHealthRes = http.get(`${ANALYTICS_URL}/healthz`);
  check(analyticsHealthRes, {
    'analytics healthz is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  // 2. Shorten a URL
  const shortenPayload = JSON.stringify({
    url: 'https://kubernetes.io/docs/concepts/overview/',
  });
  const shortenParams = {
    headers: { 'Content-Type': 'application/json' },
  };

  const shortenRes = http.post(`${SHORTENER_URL}/api/shorten`, shortenPayload, shortenParams);
  const shortenPassed = check(shortenRes, {
    'shorten status is 201 or 429': (r) => r.status === 201 || r.status === 429,
  });

  if (!shortenPassed) {
    errorRate.add(1);
    sleep(1);
    return;
  }

  if (shortenRes.status === 201) {
    const json = JSON.parse(shortenRes.body);
    const shortCode = json.shortCode;

    // 3. Resolve redirect
    const redirectRes = http.get(`${SHORTENER_URL}/${shortCode}`, { redirects: 0 });
    check(redirectRes, {
      'redirect status is 302': (r) => r.status === 302,
    }) || errorRate.add(1);

    // 4. Check Analytics
    const analyticsRes = http.get(`${ANALYTICS_URL}/api/analytics/${shortCode}`);
    check(analyticsRes, {
      'analytics status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }

  // 5. Check Prometheus metrics exposition
  const metricsRes = http.get(`${SHORTENER_URL}/metrics`);
  check(metricsRes, {
    'metrics status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);
}
