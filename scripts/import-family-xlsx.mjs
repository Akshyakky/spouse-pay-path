import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { createPool } from "./pg-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAMILY_EMAIL_DOMAIN = "family.local";
const DEFAULT_XLSX =
  process.env.FAMILY_XLSX ||
  "C:\\Users\\BIOSOFTDEV002\\Downloads\\Rvsd Family Members List-03.09.2026 (1).xlsx";

const xlsxPath = resolve(process.argv[2] || DEFAULT_XLSX);
const parsed = parseExcel(xlsxPath);

const pool = createPool();

try {
  await pool.query(`
    ALTER TABLE family_members
      ADD COLUMN IF NOT EXISTS is_deceased BOOLEAN NOT NULL DEFAULT FALSE
  `);

  const admin = await pool.query(
    `SELECT id FROM users
     WHERE email = 'admin@spousepaypath.local' OR username = 'admin'
     ORDER BY created_at
     LIMIT 1`,
  );
  const adminId = admin.rows[0]?.id;
  if (!adminId) throw new Error("Admin user not found. Run npm run db:seed first.");

  const logins = [];
  let importedFamilies = 0;
  let importedMembers = 0;
  let skipped = 0;

  for (const family of parsed.families) {
    const existing = await pool.query(`SELECT id FROM families WHERE family_no = $1`, [
      family.family_no,
    ]);
    if (existing.rows[0]) {
      console.warn(`Skipping ${family.family_no} (${family.family_name}) — already imported`);
      skipped += 1;
      continue;
    }

    const password = makePassword(family.cover_no);
    const username = String(family.username).toLowerCase();
    const email = `${username}@${FAMILY_EMAIL_DOMAIN}`;
    const passwordHash = await bcrypt.hash(password, 10);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const user = await client.query(
        `INSERT INTO users (email, username, full_name, password_hash, app_role)
         VALUES ($1, $2, $3, $4, 'family')
         RETURNING id`,
        [email, username, family.family_name, passwordHash],
      );
      const userId = user.rows[0].id;

      const inserted = await client.query(
        `INSERT INTO families
           (family_no, family_name, contact_phone, wife_user_id, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [family.family_no, family.family_name, family.contact_phone, userId, adminId],
      );
      const familyId = inserted.rows[0].id;

      for (const member of family.members) {
        await client.query(
          `INSERT INTO family_members
             (family_id, relationship, full_name, gender, date_of_birth, contact, remarks, is_head, is_deceased)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            familyId,
            member.relationship,
            member.full_name,
            member.gender,
            member.date_of_birth,
            member.contact,
            member.remarks,
            Boolean(member.is_head),
            Boolean(member.is_deceased),
          ],
        );
        importedMembers += 1;
      }

      await client.query("COMMIT");
      importedFamilies += 1;
      logins.push({
        family_no: family.family_no,
        family_name: family.family_name,
        username,
        password,
        members: family.members.length,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  const loginPath = resolve(process.cwd(), "family-logins.csv");
  writeFileSync(
    loginPath,
    ["family_no,family_name,username,password,members"]
      .concat(
        logins.map((row) =>
          [row.family_no, csv(row.family_name), row.username, row.password, row.members].join(","),
        ),
      )
      .join("\n") + "\n",
    "utf8",
  );

  console.log(`Imported ${importedFamilies} families, ${importedMembers} members. Skipped ${skipped}.`);
  console.log(`Family logins written to ${loginPath}`);
  for (const row of logins) {
    console.log(`  ${row.family_no}  ${row.username} / ${row.password}  (${row.members} members)`);
  }
} finally {
  await pool.end();
}

function parseExcel(filePath) {
  const result = spawnSync("python", [resolve(__dirname, "parse-family-xlsx.py"), filePath], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Failed to parse Excel: ${filePath}`);
  }
  return JSON.parse(result.stdout);
}

function makePassword(coverNo) {
  const suffix = randomBytes(3).toString("base64url").replace(/[^a-zA-Z0-9]/g, "X").slice(0, 4);
  return `Cover${coverNo}#${suffix}`;
}

function csv(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
