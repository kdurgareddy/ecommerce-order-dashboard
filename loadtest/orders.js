// k6 load test: 300 concurrent virtual users browsing and placing orders.
//   k6 run -e BASE_URL=http://localhost:4000 loadtest/orders.js
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:4000";

export const options = {
  scenarios: {
    sessions: {
      executor: "ramping-vus",
      stages: [
        { duration: "30s", target: 300 },
        { duration: "2m", target: 300 },
        { duration: "15s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export function setup() {
  const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email: "support@example.com", password: "Password123!" }), {
    headers: { "Content-Type": "application/json" },
  });
  const token = res.json("token");
  const auth = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
  const products = http.get(`${BASE}/api/products`, auth).json().map((p) => p.id);
  const customers = http.get(`${BASE}/api/customers`, auth).json().map((c) => c.id);
  return { token, products, customers };
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export default function ({ token, products, customers }) {
  const auth = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };

  check(http.get(`${BASE}/api/stats`, auth), { "stats 200": (r) => r.status === 200 });
  check(http.get(`${BASE}/api/orders?page=1&pageSize=20`, auth), { "orders 200": (r) => r.status === 200 });
  sleep(1);

  // ~1 in 5 sessions places an order; 409 (out of stock) is an expected outcome, not a failure.
  if (Math.random() < 0.2) {
    const res = http.post(
      `${BASE}/api/orders`,
      JSON.stringify({ customerId: pick(customers), items: [{ productId: pick(products), quantity: 1 }] }),
      Object.assign({}, auth, { responseCallback: http.expectedStatuses(201, 409) }),
    );
    check(res, { "order created or out of stock": (r) => r.status === 201 || r.status === 409 });
  }
  sleep(1);
}
