import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPool } from "./pg-env.mjs";

const pool = createPool();

try {
  const adminHash = await bcrypt.hash("Admin@123", 10);
  const result = await pool.query(
    `UPDATE users SET password_hash = $1 WHERE email = 'admin@spousepaypath.local'`,
    [adminHash],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error("Admin user not found. Run npm run db:seed first.");
  }

  console.log("Seeded password:");
  console.log("  admin@spousepaypath.local / Admin@123");
} finally {
  await pool.end();
}
