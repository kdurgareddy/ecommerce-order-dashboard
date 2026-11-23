import { Router } from "express";
import { authenticate, requirePermission } from "../auth.js";
import { pool } from "../db.js";
import { asyncHandler } from "../middleware.js";

export const statsRouter = Router();
statsRouter.use(authenticate, requirePermission("stats:read"));

statsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [totals, byStatus, daily, top, low] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) AS orders,
               COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0) AS revenue,
               COALESCE(AVG(total) FILTER (WHERE status <> 'cancelled'), 0)::numeric(12,2) AS avg_order_value,
               COUNT(*) FILTER (WHERE status IN ('pending', 'processing')) AS open_orders
        FROM orders`),
      pool.query("SELECT status, COUNT(*) AS count FROM orders GROUP BY status"),
      pool.query(`
        SELECT to_char(d, 'YYYY-MM-DD') AS day,
               COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'cancelled'), 0) AS revenue,
               COUNT(o.id) AS orders
        FROM generate_series(current_date - 13, current_date, interval '1 day') d
        LEFT JOIN orders o ON o.created_at::date = d::date
        GROUP BY d ORDER BY d`),
      pool.query(`
        SELECT p.id, p.name, SUM(oi.quantity)::int AS units
        FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
        WHERE o.status <> 'cancelled' GROUP BY p.id ORDER BY units DESC LIMIT 5`),
      pool.query("SELECT COUNT(*) AS count FROM products WHERE stock <= low_stock_threshold"),
    ]);
    res.json({
      ...totals.rows[0],
      by_status: Object.fromEntries(byStatus.rows.map((r) => [r.status, r.count])),
      daily: daily.rows,
      top_products: top.rows,
      low_stock_products: low.rows[0].count,
    });
  }),
);
