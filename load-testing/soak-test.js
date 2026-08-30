import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 VUs
    { duration: '2m', target: 20 },  // Sustained steady soak
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'],
    http_req_failed: ['rate<0.01'],
  },
};

const SHORTENER_URL = __ENV.SHORTENER_URL || 'http://localhost:3001';
const ANALYTICS_URL = __ENV.ANALYTICS_URL || 'http://localhost:3002';

export default function () {
  // Rotate through normal operational flow
  http.get(`${SHORTENER_URL}/healthz`);
  http.get(`${ANALYTICS_URL}/healthz`);
  http.get(`${SHORTENER_URL}/FKPh333`, { redirects: 0 });

  sleep(0.5);
}
