import "dotenv/config";
import pg from "pg";

function sslConfig() {
  const mode = (process.env.PGSSL || process.env.PGSSLMODE || "").toLowerCase();
  if (mode === "disable" || mode === "false") return false;
  if (mode === "require" || mode === "true" || mode === "no-verify") {
    return { rejectUnauthorized: false };
  }
  const url = process.env.DATABASE_URL ?? "";
  if (url.includes("sslmode=require") || url.includes("sslmode=verify-full") || url.includes("sslmode=verify-ca")) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export function createPool() {
  const ssl = sslConfig();
  if (process.env.DATABASE_URL) {
    return new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10, ssl });
  }
  return new pg.Pool({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || "spousepaypath",
    max: 10,
    ssl,
  });
}
