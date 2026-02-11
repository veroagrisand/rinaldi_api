import { sleep, check } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTimes = new Trend('response_time');

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m30s', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'errors': ['rate<0.1'],
    'response_time': ['p(95)<500'],
  },
};

export default function () {
  const payload = JSON.stringify({
    username: `user${Math.floor(Math.random() * 100000)}`,
    email: `user${Math.floor(Math.random() * 100000)}@example.com`,
    password: 'password123'
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const response = http.post('http://localhost:3000/api/users/auth/register/', payload, params);

  responseTimes.add(response.timings.duration);
  errorRate.add(response.status !== 200 && response.status !== 201);

  check(response, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'response has body': (r) => r.body.length > 0,
  });

  sleep(1);
}