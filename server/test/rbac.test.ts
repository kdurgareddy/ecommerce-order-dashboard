import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { signToken, verifyToken } from "../src/auth.js";
import { pool } from "../src/db.js";
import { can } from "../src/roles.js";

const app = createApp();
const token = (role: "admin" | "manager" | "support") =>
  signToken({ id: 1, email: `${role}@example.com`, name: role, role });

afterAll(() => pool.end());

describe("permissions matrix", () => {
  it("only admins manage users", () => {
    expect(can("admin", "users:manage")).toBe(true);
    expect(can("manager", "users:manage")).toBe(false);
    expect(can("support", "users:manage")).toBe(false);
  });

  it("support can create orders but not move them through the workflow", () => {
    expect(can("support", "orders:create")).toBe(true);
    expect(can("support", "orders:transition")).toBe(false);
    expect(can("support", "orders:cancel")).toBe(false);
    expect(can("manager", "orders:transition")).toBe(true);
  });

  it("only admins and managers adjust inventory", () => {
    expect(can("manager", "inventory:adjust")).toBe(true);
    expect(can("support", "inventory:adjust")).toBe(false);
  });
});

describe("JWT", () => {
  it("round-trips the user", () => {
    const u = verifyToken(token("manager"));
    expect(u).toMatchObject({ id: 1, role: "manager", email: "manager@example.com" });
  });

  it("rejects tampered tokens", () => {
    const t = token("support");
    const [h, , s] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "1", role: "admin" })).toString("base64url");
    expect(() => verifyToken(`${h}.${forged}.${s}`)).toThrow();
  });
});

describe("HTTP auth (no database needed)", () => {
  it("health is public", async () => {
    await request(app).get("/api/health").expect(200, { status: "ok" });
  });

  it("401 without a token", async () => {
    await request(app).get("/api/orders").expect(401);
  });

  it("401 with a bad token", async () => {
    await request(app).get("/api/orders").set("Authorization", "Bearer nope").expect(401);
  });

  it("403 when support lists users", async () => {
    await request(app).get("/api/users").set("Authorization", `Bearer ${token("support")}`).expect(403);
  });

  it("403 when support tries to ship an order", async () => {
    await request(app)
      .post("/api/orders/1/status")
      .set("Authorization", `Bearer ${token("support")}`)
      .send({ status: "shipped" })
      .expect(403);
  });

  it("400 on invalid order payload (validated before touching the DB)", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token("support")}`)
      .send({ customerId: 1, items: [] })
      .expect(400);
    expect(res.body.details.items).toBeDefined();
  });
});
