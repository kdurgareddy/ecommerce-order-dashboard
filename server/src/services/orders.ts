import { pool, tx, type Queryable } from "../db.js";
import { conflict, HttpError, notFound } from "../errors.js";
import { canTransition, nextStatuses, restocksOn, type OrderStatus } from "./orderStatus.js";

export interface NewOrder {
  customerId: number;
  items: { productId: number; quantity: number }[];
  notes?: string;
}

/**
 * Workflow 1 – place an order.
 * Locks the product rows (in id order, so two orders can never deadlock),
 * checks stock, reserves it and writes the order in one transaction.
 */
export async function createOrder(input: NewOrder, userId: number) {
  // merge duplicate lines for the same product
  const qty = new Map<number, number>();
  for (const it of input.items) qty.set(it.productId, (qty.get(it.productId) ?? 0) + it.quantity);
  const ids = [...qty.keys()].sort((a, b) => a - b);

  return tx(async (c) => {
    const cust = await c.query("SELECT id FROM customers WHERE id = $1", [input.customerId]);
    if (cust.rowCount === 0) throw notFound("customer");

    const { rows: products } = await c.query<{ id: number; name: string; price: number; stock: number }>(
      "SELECT id, name, price, stock FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE",
      [ids],
    );
    if (products.length !== ids.length) {
      const found = new Set(products.map((p) => p.id));
      throw new HttpError(404, "product not found", { missing: ids.filter((id) => !found.has(id)) });
    }

    const short = products
      .filter((p) => p.stock < qty.get(p.id)!)
      .map((p) => ({ productId: p.id, name: p.name, available: p.stock, requested: qty.get(p.id)! }));
    if (short.length) throw conflict("insufficient stock", short);

    const total = round2(products.reduce((sum, p) => sum + p.price * qty.get(p.id)!, 0));
    const { rows: [order] } = await c.query(
      `INSERT INTO orders (customer_id, status, total, notes, created_by)
       VALUES ($1, 'pending', $2, $3, $4) RETURNING *`,
      [input.customerId, total, input.notes ?? null, userId],
    );

    for (const p of products) {
      const q = qty.get(p.id)!;
      await c.query("UPDATE products SET stock = stock - $1, updated_at = now() WHERE id = $2", [q, p.id]);
      await c.query(
        "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)",
        [order.id, p.id, q, p.price],
      );
    }
    await c.query(
      "INSERT INTO order_events (order_id, from_status, to_status, user_id, note) VALUES ($1, NULL, 'pending', $2, 'order placed')",
      [order.id, userId],
    );
    return order;
  });
}

/**
 * Workflows 2–4 – process / ship / deliver, and cancel with restock.
 */
export async function transitionOrder(orderId: number, to: OrderStatus, userId: number, note?: string) {
  return tx(async (c) => {
    const { rows } = await c.query<{ id: number; status: OrderStatus }>(
      "SELECT id, status FROM orders WHERE id = $1 FOR UPDATE",
      [orderId],
    );
    if (!rows.length) throw notFound("order");
    const from = rows[0].status;
    if (!canTransition(from, to)) {
      throw conflict(`cannot move order from ${from} to ${to}`, { allowed: nextStatuses(from) });
    }

    if (restocksOn(to)) {
      await c.query(
        `UPDATE products p SET stock = p.stock + oi.quantity, updated_at = now()
         FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = p.id`,
        [orderId],
      );
    }
    const { rows: [order] } = await c.query(
      "UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *",
      [to, orderId],
    );
    await c.query(
      "INSERT INTO order_events (order_id, from_status, to_status, user_id, note) VALUES ($1, $2, $3, $4, $5)",
      [orderId, from, to, userId, note ?? null],
    );
    return order;
  });
}

export async function getOrder(orderId: number, db: Queryable = pool) {
  const { rows: [order] } = await db.query(
    `SELECT o.*, c.name AS customer_name, c.email AS customer_email
     FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`,
    [orderId],
  );
  if (!order) throw notFound("order");
  const { rows: items } = await db.query(
    `SELECT oi.id, oi.product_id, p.sku, p.name, oi.quantity, oi.unit_price,
            (oi.quantity * oi.unit_price)::numeric(12,2) AS line_total
     FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1 ORDER BY oi.id`,
    [orderId],
  );
  const { rows: events } = await db.query(
    `SELECT e.id, e.from_status, e.to_status, e.note, e.created_at, u.name AS user_name
     FROM order_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.order_id = $1 ORDER BY e.id`,
    [orderId],
  );
  return { ...order, items, events, next_statuses: nextStatuses(order.status) };
}

export interface OrderQuery {
  status?: OrderStatus;
  q?: string;
  customerId?: number;
  page: number;
  pageSize: number;
}

export async function listOrders({ status, q, customerId, page, pageSize }: OrderQuery) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (status) where.push(`o.status = $${params.push(status)}`);
  if (customerId) where.push(`o.customer_id = $${params.push(customerId)}`);
  if (q) where.push(`(c.name ILIKE $${params.push(`%${q}%`)} OR o.id::text = $${params.push(q)})`);
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*) FROM orders o JOIN customers c ON c.id = o.customer_id ${clause}`,
    params,
  );
  const { rows } = await pool.query(
    `SELECT o.id, o.status, o.total, o.created_at, o.updated_at, c.id AS customer_id, c.name AS customer_name,
            (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id)::int AS item_count
     FROM orders o JOIN customers c ON c.id = o.customer_id ${clause}
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT $${params.push(pageSize)} OFFSET $${params.push((page - 1) * pageSize)}`,
    params,
  );
  return { data: rows, page, pageSize, total: count };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
