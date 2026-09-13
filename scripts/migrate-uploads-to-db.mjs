import "dotenv/config";
import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import { extname, join, resolve } from "path";
import { createPool } from "./pg-env.mjs";

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const pool = createPool();
const uploadsRoot = resolve(process.cwd(), process.env.UPLOADS_DIR || "uploads");

const targets = [
  { table: "families", column: "family_photo_url" },
  { table: "family_members", column: "photo_url" },
  { table: "payments", column: "screenshot_url" },
  { table: "expenses", column: "attachment_url" },
];

let migrated = 0;
let skipped = 0;

try {
  for (const { table, column } of targets) {
    const { rows } = await pool.query(
      `SELECT id, ${column} AS file_key FROM ${table} WHERE ${column} IS NOT NULL AND btrim(${column}) <> ''`,
    );

    for (const row of rows) {
      const key = String(row.file_key ?? "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");
      if (!key || UUID_RE.test(key)) {
        skipped += 1;
        continue;
      }

      const abs = join(uploadsRoot, key);
      if (!abs.startsWith(uploadsRoot) || !existsSync(abs)) {
        console.warn(`Missing file for ${table}.${column} ${row.id}: ${key}`);
        skipped += 1;
        continue;
      }

      const buffer = readFileSync(abs);
      if (buffer.length > 10 * 1024 * 1024) {
        console.warn(`Too large, skipped ${table}.${column} ${row.id}: ${key}`);
        skipped += 1;
        continue;
      }

      const id = randomUUID();
      const ext = extname(key).toLowerCase();
      const slash = key.lastIndexOf("/");
      const folder = slash === -1 ? "legacy" : key.slice(0, slash);
      const filename = slash === -1 ? key : key.slice(slash + 1);
      const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

      await pool.query(
        `INSERT INTO stored_files
           (id, folder, original_filename, content_type, content, byte_length)
         VALUES
           ($1, $2, $3, $4, $5, $6)`,
        [id, folder, filename, contentType, buffer, buffer.length],
      );

      await pool.query(`UPDATE ${table} SET ${column} = $1 WHERE id = $2`, [id, row.id]);

      migrated += 1;
      console.log(`Migrated ${table}.${column} ${row.id} -> ${id}`);
    }
  }

  console.log(`Done. migrated=${migrated} skipped=${skipped}`);
} finally {
  await pool.end();
}
