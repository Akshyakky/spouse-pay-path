import "dotenv/config";
import sql from "mssql";

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

const exists = await pool.request().query(`
  SELECT COL_LENGTH(N'dbo.family_members', N'is_head') AS col_len
`);

if (exists.recordset[0]?.col_len == null) {
  await pool.request().query(`
    ALTER TABLE dbo.family_members
      ADD is_head BIT NOT NULL
        CONSTRAINT DF_family_members_is_head DEFAULT (0)
  `);
  console.log("is_head column added to family_members");
} else {
  console.log("is_head column already exists on family_members");
}

const idx = await pool.request().query(`
  SELECT 1 AS ok
  FROM sys.indexes
  WHERE name = N'UQ_family_members_one_head'
    AND object_id = OBJECT_ID(N'dbo.family_members')
`);

if (!idx.recordset[0]) {
  await pool.request().query(`
    CREATE UNIQUE INDEX UQ_family_members_one_head
      ON dbo.family_members (family_id)
      WHERE is_head = 1
  `);
  console.log("UQ_family_members_one_head index created");
} else {
  console.log("UQ_family_members_one_head already exists");
}

const backfill = await pool.request().query(`
  ;WITH ranked AS (
    SELECT
      id,
      family_id,
      ROW_NUMBER() OVER (
        PARTITION BY family_id
        ORDER BY
          CASE relationship
            WHEN N'husband' THEN 1
            WHEN N'wife' THEN 2
            ELSE 3
          END,
          created_at
      ) AS rn
    FROM dbo.family_members
    WHERE family_id NOT IN (
      SELECT family_id FROM dbo.family_members WHERE is_head = 1
    )
  )
  UPDATE m
  SET m.is_head = 1
  FROM dbo.family_members m
  INNER JOIN ranked r ON r.id = m.id
  WHERE r.rn = 1;

  SELECT @@ROWCOUNT AS updated;
`);

console.log(`Backfilled head for ${backfill.recordset[0]?.updated ?? 0} families`);

await pool.close();
