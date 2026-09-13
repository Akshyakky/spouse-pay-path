import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createPool } from "./pg-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = process.argv.includes("--seed");
const pool = createPool();

try {
  const schema = readFileSync(join(__dirname, "../postgres/schema.sql"), "utf8");
  await pool.query(schema);
  if (seed) {
    const seedSql = readFileSync(join(__dirname, "../postgres/seed.sql"), "utf8");
    await pool.query(seedSql);
  }
  console.log(seed ? "Initialized PostgreSQL schema and sample data." : "Initialized PostgreSQL schema.");
} finally {
  await pool.end();
}
