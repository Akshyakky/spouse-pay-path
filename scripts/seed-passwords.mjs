import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPool } from "./pg-env.mjs";

const pool = createPool();

try {
  const adminHash = await bcrypt.hash("Admin@123", 10);
  const familyHash = await bcrypt.hash("Family@123", 10);

  await pool.query(`UPDATE users SET password_hash = $1 WHERE email = 'admin@spousepaypath.local'`, [
    adminHash,
  ]);

  await pool.query(
    `UPDATE users SET password_hash = $1
     WHERE email IN ('priya.sharma@example.com', 'anita.patel@example.com', 'priya@family.local', 'anita@family.local')
        OR username IN ('priya', 'anita')`,
    [familyHash],
  );

  const { rows } = await pool.query(
    `SELECT id, email, username FROM users
     WHERE username IN ('priya', 'anita') OR email ILIKE 'priya%' OR email ILIKE 'anita%'`,
  );

  for (const row of rows) {
    const username = String(row.username || String(row.email).split("@")[0]).toLowerCase();
    const email = `${username}@family.local`;
    await pool.query(
      `UPDATE users
       SET email = $1, username = $2, password_hash = $3
       WHERE id = $4`,
      [email, username, familyHash, row.id],
    );
  }

  console.log("Seeded passwords:");
  console.log("  admin@spousepaypath.local / Admin@123");
  console.log("  priya / Family@123");
  console.log("  anita / Family@123");
} finally {
  await pool.end();
}
