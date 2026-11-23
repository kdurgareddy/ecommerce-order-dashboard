import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../auth.js";
import { pool, tx } from "../db.js";
import { conflict, notFound } from "../errors.js";
import { asyncHandler, parse } from "../middleware.js";

export const productsRouter = Router();
productsRouter.use(authenticate);

productsRouter.get(
  "/",
  requirePermission("products:read"),
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const lowOnly = req.query.low === "true";
    const { rows } = await pool.query(
      `SELECT * FROM products
       WHERE ($1 = '' OR name ILIKE '%' || $1 || '%' OR sku ILIKE '%' || $1 || '%')
         AND (NOT $2 OR stock <= low_stock_threshold)
       ORDER BY name`,
      [q, lowOnly],
    );
    res.json(rows);
  }),
);

productsRouter.get(
  "/:id",
  requirePermission("products:read"),
  asyncHandler(async (req, res) => {
    const { rows: [p] } = await pool.query("SELECT * FROM products WHERE id = $1", [Number(req.params.id)]);
    if (!p) throw notFound("product");
    const { rows: adjustments } = await pool.query(
      `SELECT a.id, a.delta, a.reason, a.created_at, u.name AS user_name
       FROM inventory_adjustments a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.product_id = $1 ORDER BY a.id DESC LIMIT 20`,
      [p.id],
    );
    res.json({ ...p, adjustments });
  }),
);

const ProductBody = z.object({
  sku: z.string().min(1).max(32).regex(/^[A-Za-z0-9-_]+$/),
  name: z.string().min(1).max(200),
  price: z.number().nonnegative().multipleOf(0.01),
  low_stock_threshold: z.number().int().min(0).default(5),
});

productsRouter.post(
  "/",
  requirePermission("products:write"),
  asyncHandler(async (req, res) => {
    const b = parse(ProductBody.extend({ stock: z.number().int().min(0).default(0) }), req.body);
    const { rows: [p] } = await pool.query(
      "INSERT INTO products (sku, name, price, stock, low_stock_threshold) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [b.sku, b.name, b.price, b.stock, b.low_stock_threshold],
    );
    res.status(201).json(p);
  }),
);

productsRouter.put(
  "/:id",
  requirePermission("products:write"),
  asyncHandler(async (req, res) => {
    const b = parse(ProductBody, req.body);
    const { rows: [p] } = await pool.query(
      `UPDATE products SET sku = $1, name = $2, price = $3, low_stock_threshold = $4, updated_at = now()
       WHERE id = $5 RETURNING *`,
      [b.sku, b.name, b.price, b.low_stock_threshold, Number(req.params.id)],
    );
    if (!p) throw notFound("product");
    res.json(p);
  }),
);

const AdjustBody = z.object({ delta: z.number().int().refine((d) => d !== 0, "delta cannot be 0"), reason: z.string().min(3).max(200) });

/** Inventory update: receive stock (+) or write off (-), with an audit row. */
productsRouter.post(
  "/:id/adjust",
  requirePermission("inventory:adjust"),
  asyncHandler(async (req, res) => {
    const { delta, reason } = parse(AdjustBody, req.body);
    const id = Number(req.params.id);
    const product = await tx(async (c) => {
      const { rows: [p] } = await c.query("SELECT stock FROM products WHERE id = $1 FOR UPDATE", [id]);
      if (!p) throw notFound("product");
      if (p.stock + delta < 0) throw conflict("stock cannot go below zero", { stock: p.stock, delta });
      const { rows: [updated] } = await c.query(
        "UPDATE products SET stock = stock + $1, updated_at = now() WHERE id = $2 RETURNING *",
        [delta, id],
      );
      await c.query(
        "INSERT INTO inventory_adjustments (product_id, delta, reason, user_id) VALUES ($1, $2, $3, $4)",
        [id, delta, reason, req.user!.id],
      );
      return updated;
    });
    res.json(product);
  }),
);
