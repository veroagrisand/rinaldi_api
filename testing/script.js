import http from 'k6/http';
import { sleep, check } from 'k6';
import { Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Load users from JSON
const users = new SharedArray('users', function () {
  return JSON.parse(open('./100users.json'));
});

const registerTime = new Trend('register_response_time');


const BASE_URL = 'http://localhost:3000/';
const REGISTER_URL = `${BASE_URL}api/auth/register`;
const LOGIN_URL = `${BASE_URL}api/auth/login`;

export const options = {
  scenarios: {
    default: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
    },
  },
};


export default function() {
  let res = http.get(`${BASE_URL}`);
  check(res, { "status is 200": (res) => res.status === 200 });
  sleep(1);
}

export function register100user(data){
  const user = users[__ITER % users.length];
  
  const start = Date.now();
  const res = http.post(
    REGISTER_URL,
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
}

export function login100user(data){
  const user = users[__ITER % users.length];
  
  const start = Date.now();
  const res = http.post(
    LOGIN_URL,
    JSON.stringify({
      email: user.email,
      password: user.password,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  const duration = Date.now() - start;
  registerTime.add(duration);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  // Extract and save auth token
  const token = res.json('token') || res.json('access_token');
  
  if (token) {
    // Use token to access another endpoint
    const protectedRes = http.get(
      `${BASE_URL}api/products`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    check(protectedRes, {
      'protected endpoint status is 200': (r) => r.status === 200,
    });
  }
}
