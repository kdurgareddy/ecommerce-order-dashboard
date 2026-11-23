# E-Commerce Order Management Dashboard

A full-stack order management platform: a **React + TypeScript** dashboard on top of a **Node.js / Express (TypeScript)** REST API with **PostgreSQL**, **JWT** authentication and role-based access control for three user types. Everything runs with one `docker compose up`.

```
client/  React 18 + TypeScript + Vite   (12 screens, served by nginx in Docker)
server/  Express + TypeScript + pg + zod (REST API, JWT, RBAC, transactional order workflows)
loadtest/ k6 script for 300 concurrent sessions
```

## Screens (12)

| Screen | What it does |
| --- | --- |
| Login | JWT sign-in |
| Dashboard | Revenue, order count, average order value, open orders, low-stock count, 14-day revenue chart, orders by status, top products |
| Orders | Search, filter by status, paginate |
| Order detail | Line items, customer, status timeline, workflow actions for the user's role |
| New order | Choose a customer, add lines with live stock and totals |
| Inventory | Product list, low-stock filter, stock adjustment dialog |
| Product form | Create or edit a product, with its adjustment history |
| Customers | Search and add customers, order count and lifetime value |
| Customer detail | Contact info and order history |
| Users | Admin-only list; enable or disable accounts |
| User form | Admin-only create or edit with role selection |
| My account | Profile and password change |

## Roles

| Permission | admin | manager | support |
| --- | :-: | :-: | :-: |
| View orders, products, customers, dashboard | ✓ | ✓ | ✓ |
| Create customers and orders | ✓ | ✓ | ✓ |
| Advance or cancel orders | ✓ | ✓ | |
| Create and edit products, adjust inventory | ✓ | ✓ | |
| Manage users | ✓ | | |

The server enforces these in `server/src/roles.ts`; the client only uses them to hide controls.

## Order workflows

```
pending ──► processing ──► shipped ──► delivered
   │             │
   └──► cancelled ◄┘   (cancelling restocks every item)
```

1. **Place order**: locks the product rows (in id order, so concurrent orders can't deadlock), checks stock, reserves it, and writes the order and its lines in one transaction. Returns 409 with per-product shortfalls if stock runs out.
2. **Process → ship → deliver**: each step is checked against the state machine in `services/orderStatus.ts`; illegal jumps return 409 with the allowed next states.
3. **Cancel and restock**: returns every line's quantity to inventory in the same transaction.
4. **Inventory adjustment**: receive or write off stock with a required reason and an audit row.

Every status change is written to `order_events` with the acting user, which feeds the timeline on the order page.

## Run it

```bash
docker compose up --build

# in another terminal: load demo users, products and customers
cd server && npm install && npm run seed
```

Open http://localhost:8080 and sign in as `admin@example.com`, `manager@example.com` or `support@example.com` (password `Password123!`) after seeding.

### Local development

```bash
docker compose up -d db

cd server
npm install
npm run seed      # creates the schema and demo data
npm run dev       # http://localhost:4000

cd ../client
npm install
npm run dev       # http://localhost:5173, proxies /api to :4000
```

## API

All routes are under `/api` and, except `/auth/login` and `/health`, need `Authorization: Bearer <token>`.

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/auth/login` | public |
| `GET` | `/auth/me` · `POST /auth/password` | any |
| `GET` | `/stats` | any |
| `GET` | `/orders?status=&q=&customerId=&page=&pageSize=` · `/orders/:id` | any |
| `POST` | `/orders` | any |
| `POST` | `/orders/:id/status` `{status}` · `/orders/:id/cancel` | admin, manager |
| `GET` | `/products?q=&low=true` · `/products/:id` | any |
| `POST` / `PUT` | `/products` · `/products/:id` | admin, manager |
| `POST` | `/products/:id/adjust` `{delta, reason}` | admin, manager |
| `GET` / `POST` | `/customers` · `GET /customers/:id` | any |
| `GET` / `POST` / `PATCH` | `/users` · `/users/:id` | admin |

Request bodies are validated with zod; errors come back as `{ "error": "...", "details": ... }`.

## Tests

```bash
cd server && npm test
```

Vitest and Supertest cover the order state machine, the permission matrix, JWT signing and tamper detection, and the HTTP auth layer (401 / 403 / 400 paths).

## Load test

With the stack running and seeded, [k6](https://k6.io) ramps to 300 concurrent virtual users that load the dashboard, page through orders and place orders:

```bash
k6 run -e BASE_URL=http://localhost:4000 loadtest/orders.js
```

The script fails if more than 1% of requests error or p95 latency goes over 500 ms. Your results will depend on the machine it runs on.

## Tech

React 18, React Router 6, TypeScript, Vite · Node.js 22, Express 4, pg, zod, jsonwebtoken, bcryptjs, helmet · PostgreSQL 16 · Docker, nginx · Vitest, Supertest, k6 · GitHub Actions
