import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Load products from JSON
const products = new SharedArray('products', function () {
  return JSON.parse(open('./100products.json'));
});

const createProductTime = new Trend('create_product_response_time');

export const options = {
  scenarios: {
    test_100_products: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 100,
      maxDuration: '5m',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://api.verospace.app';
const TOKEN = __ENV.ADMIN_TOKEN || '';

export default function () {
  const product = products[__ITER % products.length];

  const payload = {
    sort: product.sort || 0,
    category_id: product.category_id,
    name: product.name,
    slug: String(product.slug).toLowerCase(),
    image: product.image || null,
    description: product.description || null,
    status: product.status !== undefined ? product.status : 1,
  };

  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/products`,
    JSON.stringify(payload),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
    }
  );
  const duration = Date.now() - start;
  createProductTime.add(duration);

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
