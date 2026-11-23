import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../auth.js";
import { asyncHandler, parse } from "../middleware.js";
import { ORDER_STATUSES } from "../services/orderStatus.js";
import { createOrder, getOrder, listOrders, transitionOrder } from "../services/orders.js";

export const ordersRouter = Router();
ordersRouter.use(authenticate);

const ListQuery = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  q: z.string().max(100).optional(),
  customerId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

ordersRouter.get(
  "/",
  requirePermission("orders:read"),
  asyncHandler(async (req, res) => {
    res.json(await listOrders(parse(ListQuery, req.query)));
  }),
);

ordersRouter.get(
  "/:id",
  requirePermission("orders:read"),
  asyncHandler(async (req, res) => {
    res.json(await getOrder(Number(req.params.id)));
  }),
);

const CreateBody = z.object({
  customerId: z.number().int().positive(),
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(1000) })).min(1).max(50),
  notes: z.string().max(500).optional(),
});

ordersRouter.post(
  "/",
  requirePermission("orders:create"),
  asyncHandler(async (req, res) => {
    const order = await createOrder(parse(CreateBody, req.body), req.user!.id);
    res.status(201).json(await getOrder(order.id));
  }),
);

const StatusBody = z.object({
  status: z.enum(["processing", "shipped", "delivered"]),
  note: z.string().max(300).optional(),
});

ordersRouter.post(
  "/:id/status",
  requirePermission("orders:transition"),
  asyncHandler(async (req, res) => {
    const { status, note } = parse(StatusBody, req.body);
    await transitionOrder(Number(req.params.id), status, req.user!.id, note);
    res.json(await getOrder(Number(req.params.id)));
  }),
);

ordersRouter.post(
  "/:id/cancel",
  requirePermission("orders:cancel"),
  asyncHandler(async (req, res) => {
    const { note } = parse(z.object({ note: z.string().max(300).optional() }), req.body ?? {});
    await transitionOrder(Number(req.params.id), "cancelled", req.user!.id, note);
    res.json(await getOrder(Number(req.params.id)));
  }),
);
