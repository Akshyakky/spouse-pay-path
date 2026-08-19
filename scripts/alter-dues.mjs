import "dotenv/config";
import sql from "mssql";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlText = readFileSync(join(__dirname, "../mssql/alter_dues.sql"), "utf8");

const pool = await sql.connect({
  server: process.env.MSSQL_SERVER,
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === "true",
    trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE !== "false",
  },
});

const batches = sqlText
  .split(/^\s*GO\s*$/gim)
  .map((b) => b.trim())
  .filter(Boolean);

for (const batch of batches) {
  await pool.request().query(batch);
}

console.log("Dues schema applied (payment_demands, family_dues, payments.family_due_id)");
await pool.close();
