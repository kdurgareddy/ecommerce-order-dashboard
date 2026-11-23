import bcrypt from "bcryptjs";
import { fileURLToPath } from "node:url";
import { pool, tx } from "../db.js";
import { migrate } from "./migrate.js";

const USERS = [
  { email: "admin@example.com", name: "Ada Admin", role: "admin" },
  { email: "manager@example.com", name: "Max Manager", role: "manager" },
  { email: "support@example.com", name: "Sam Support", role: "support" },
];

const PRODUCTS = [
  ["KB-101", "Mechanical Keyboard", 89.99, 40],
  ["MS-202", "Wireless Mouse", 29.5, 120],
  ["MN-303", "27\" Monitor", 249.0, 15],
  ["HS-404", "USB Headset", 45.0, 60],
  ["CB-505", "USB-C Cable (2m)", 9.99, 300],
  ["DK-606", "Laptop Dock", 139.0, 8],
  ["WC-707", "1080p Webcam", 59.0, 25],
  ["LS-808", "Laptop Stand", 34.0, 4],
] as const;

const CUSTOMERS = [
  ["Priya Sharma", "priya@example.com", "Dallas, TX"],
  ["Jordan Lee", "jordan@example.com", "Austin, TX"],
  ["Maria Garcia", "maria@example.com", "Houston, TX"],
  ["Chen Wei", "chen@example.com", "Denton, TX"],
  ["Alex Johnson", "alex@example.com", "Plano, TX"],
] as const;

export async function seed(): Promise<void> {
  await migrate();
  const hash = await bcrypt.hash("Password123!", 10);
  await tx(async (c) => {
    for (const u of USERS) {
      await c.query(
        `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
        [u.email, u.name, hash, u.role],
      );
    }
    for (const [sku, name, price, stock] of PRODUCTS) {
      await c.query(
        `INSERT INTO products (sku, name, price, stock) VALUES ($1, $2, $3, $4) ON CONFLICT (sku) DO NOTHING`,
        [sku, name, price, stock],
      );
    }
    for (const [name, email, address] of CUSTOMERS) {
      await c.query(
        `INSERT INTO customers (name, email, address) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`,
        [name, email, address],
      );
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(() => console.log("seeded: admin@example.com / manager@example.com / support@example.com (Password123!)"))
    .finally(() => pool.end());
}
