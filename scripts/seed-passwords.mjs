import "dotenv/config";
import sql from "mssql";
import bcrypt from "bcryptjs";

async function main() {
  const pool = await sql.connect({
    server: process.env.MSSQL_SERVER || "BIOSOFTDEV002",
    database: process.env.MSSQL_DATABASE || "SpousePayPath",
    user: process.env.MSSQL_USER || "ESUSER",
    password: process.env.MSSQL_PASSWORD || "ESUSER",
    options: {
      encrypt: process.env.MSSQL_ENCRYPT === "true",
      trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE !== "false",
    },
  });

  const adminHash = await bcrypt.hash("Admin@123", 10);
  const familyHash = await bcrypt.hash("Family@123", 10);

  await pool
    .request()
    .input("hash", adminHash)
    .query(
      `UPDATE dbo.users SET password_hash = @hash WHERE email = N'admin@spousepaypath.local'`,
    );

  await pool
    .request()
    .input("hash", familyHash)
    .query(
      `UPDATE dbo.users SET password_hash = @hash
       WHERE email IN (N'priya.sharma@example.com', N'anita.patel@example.com', N'priya@family.local', N'anita@family.local')
          OR username IN (N'priya', N'anita')`,
    );

  // Sample data used example.com emails; also ensure family.local aliases exist for username login.
  // Update priya/anita emails to family.local form expected by loginIdentifierToEmail if needed.
  const priya = await pool
    .request()
    .query(`SELECT id, email, username FROM dbo.users WHERE username = N'priya' OR email LIKE N'priya%'`);
  const anita = await pool
    .request()
    .query(`SELECT id, email, username FROM dbo.users WHERE username = N'anita' OR email LIKE N'anita%'`);

  for (const row of [...priya.recordset, ...anita.recordset]) {
    const username = String(row.username || String(row.email).split("@")[0]).toLowerCase();
    const email = `${username}@family.local`;
    await pool
      .request()
      .input("id", row.id)
      .input("email", email)
      .input("username", username)
      .input("hash", familyHash)
      .query(
        `UPDATE dbo.users
         SET email = @email, username = @username, password_hash = @hash
         WHERE id = @id`,
      );
  }

  console.log("Seeded passwords:");
  console.log("  admin@spousepaypath.local / Admin@123");
  console.log("  priya / Family@123");
  console.log("  anita / Family@123");
  await pool.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
