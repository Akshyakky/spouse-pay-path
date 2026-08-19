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

async function ensureColumn(name, ddl) {
  const exists = await pool.request().query(`
    SELECT COL_LENGTH(N'dbo.family_members', N'${name}') AS col_len
  `);
  if (exists.recordset[0]?.col_len == null) {
    await pool.request().query(ddl);
    console.log(`${name} column added to family_members`);
  } else {
    console.log(`${name} column already exists on family_members`);
  }
}

await ensureColumn("id_card_type", `ALTER TABLE dbo.family_members ADD id_card_type NVARCHAR(30) NULL`);
await ensureColumn("id_card_number", `ALTER TABLE dbo.family_members ADD id_card_number NVARCHAR(50) NULL`);

const ck = await pool.request().query(`
  SELECT 1 AS ok
  FROM sys.check_constraints
  WHERE name = N'CK_family_members_id_card_type'
    AND parent_object_id = OBJECT_ID(N'dbo.family_members')
`);

if (!ck.recordset[0]) {
  await pool.request().query(`
    ALTER TABLE dbo.family_members
      ADD CONSTRAINT CK_family_members_id_card_type
      CHECK (
        id_card_type IS NULL
        OR id_card_type IN (N'aadhaar', N'pan', N'epic', N'dl', N'ration_card')
      )
  `);
  console.log("CK_family_members_id_card_type added");
} else {
  console.log("CK_family_members_id_card_type already exists");
}

await pool.close();
