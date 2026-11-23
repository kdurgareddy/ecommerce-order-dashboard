import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../auth.js";
import { pool } from "../db.js";
import { conflict, notFound } from "../errors.js";
import { asyncHandler, parse } from "../middleware.js";
import { ROLES } from "../roles.js";

export const usersRouter = Router();
usersRouter.use(authenticate, requirePermission("users:manage"));

const COLUMNS = "id, email, name, role, active, created_at";

usersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM users ORDER BY id`);
    res.json(rows);
  }),
);

const CreateUser = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(ROLES),
  password: z.string().min(8).max(128),
});

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const b = parse(CreateUser, req.body);
    const { rows: [u] } = await pool.query(
      `INSERT INTO users (email, name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
      [b.email.toLowerCase(), b.name, b.role, await bcrypt.hash(b.password, 10)],
    );
    res.status(201).json(u);
  }),
);

const UpdateUser = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
});

usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = parse(UpdateUser, req.body);
    if (id === req.user!.id && ((b.role && b.role !== "admin") || b.active === false)) {
      throw conflict("you cannot demote or deactivate your own account");
    }
    const { rows: [u] } = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), role = COALESCE($2, role), active = COALESCE($3, active)
       WHERE id = $4 RETURNING ${COLUMNS}`,
      [b.name ?? null, b.role ?? null, b.active ?? null, id],
    );
    if (!u) throw notFound("user");
    res.json(u);
  }),
);
