import http from 'http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const product = new SharedArray('products', function () {
  return JSON.parse(open('./product100.json'));
});

const productInputTime = new Trend('product_input_response_time');

export const options = {
  scenarios: {
    test_100_products: {
  executor: 'shared-iterations',
  vus: 1, 
  iterations: 100,
  maxDuration: '5m',
}
}
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const prod = product[__ITER % product.length];

  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/products`,
    JSON.stringify({
      name: prod.name,
      description: prod.description,
      price: prod.price,
      category: prod.category,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  const duration = Date.now() - start;
  productInputTime.add(duration);
  
  check(res, {
    'status 201 or 409': (r) => r.status === 201 || r.status === 409,
  });
}

export function handleSummary(data) {
  const totalMs = data.state.testRunDurationMs || 0;
  const totalSec = (totalMs / 1000).toFixed(2);
  
  const summary = textSummary(data, { indent: ' ', enableColors: true });
  return {
    stdout: `${summary}\nTotal test duration: ${totalSec}s\n`,
  };
}

