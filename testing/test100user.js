import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Load users from JSON
const users = new SharedArray('users', function () {
  return JSON.parse(open('./100users.json'));
});

const registerTime = new Trend('register_response_time');

export const options = {
  scenarios: {
    test_100_users: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 100,
      maxDuration: '5m',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const user = users[__ITER % users.length];

  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      name: user.name,
      username: user.username,
      email: user.email,
      password: user.password,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  const duration = Date.now() - start;
  registerTime.add(duration);

  check(res, {
    'status 201 or 409': (r) => r.status === 201 || r.status === 409,
  });

  sleep(1);
}

export function handleSummary(data) {
  const totalMs = data.state.testRunDurationMs || 0;
  const totalSec = (totalMs / 1000).toFixed(2);

  const summary = textSummary(data, { indent: ' ', enableColors: true });
  return {
    stdout: `${summary}\nTotal test duration: ${totalSec}s\n`,
  };
}
  