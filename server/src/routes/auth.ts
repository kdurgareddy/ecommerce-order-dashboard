import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { authenticate, signToken } from "../auth.js";
import { pool } from "../db.js";
import { unauthorized } from "../errors.js";
import { asyncHandler, parse } from "../middleware.js";

export const authRouter = Router();

// Real bcrypt hash used when the email is unknown, so the response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const LoginBody = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = parse(LoginBody, req.body);
    const { rows: [u] } = await pool.query(
      "SELECT id, email, name, role, password_hash, active FROM users WHERE email = $1",
      [email.toLowerCase()],
    );
    const ok = await bcrypt.compare(password, u?.password_hash ?? DUMMY_HASH);
    if (!u || !ok || !u.active) throw unauthorized("invalid email or password");
    const user = { id: u.id, email: u.email, name: u.name, role: u.role };
    res.json({ token: signToken(user), user });
  }),
);

authRouter.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

const PasswordBody = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) });

authRouter.post(
  "/password",
  authenticate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = parse(PasswordBody, req.body);
    const { rows: [u] } = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.user!.id]);
    if (!u || !(await bcrypt.compare(currentPassword, u.password_hash))) throw unauthorized("current password is wrong");
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(newPassword, 10), req.user!.id]);
    res.status(204).end();
  }),
);
