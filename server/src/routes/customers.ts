import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../auth.js";
import { pool } from "../db.js";
import { notFound } from "../errors.js";
import { asyncHandler, parse } from "../middleware.js";

export const customersRouter = Router();
customersRouter.use(authenticate);

customersRouter.get(
  "/",
  requirePermission("customers:read"),
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const { rows } = await pool.query(
      `SELECT c.*, COUNT(o.id)::int AS order_count, COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'cancelled'), 0) AS lifetime_value
       FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
       WHERE ($1 = '' OR c.name ILIKE '%' || $1 || '%' OR c.email ILIKE '%' || $1 || '%')
       GROUP BY c.id ORDER BY c.name`,
      [q],
    );
    res.json(rows);
  }),
);

customersRouter.get(
  "/:id",
  requirePermission("customers:read"),
  asyncHandler(async (req, res) => {
    const { rows: [c] } = await pool.query("SELECT * FROM customers WHERE id = $1", [Number(req.params.id)]);
    if (!c) throw notFound("customer");
    res.json(c);
  }),
);

const CustomerBody = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
});

customersRouter.post(
  "/",
  requirePermission("customers:write"),
  asyncHandler(async (req, res) => {
    const b = parse(CustomerBody, req.body);
    const { rows: [c] } = await pool.query(
      "INSERT INTO customers (name, email, phone, address) VALUES ($1, $2, $3, $4) RETURNING *",
      [b.name, b.email.toLowerCase(), b.phone ?? null, b.address ?? null],
    );
    res.status(201).json(c);
  }),
);
