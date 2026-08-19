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

const width = await pool.request().query(`
  SELECT CHARACTER_MAXIMUM_LENGTH AS max_len
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = N'dbo'
    AND TABLE_NAME = N'family_members'
    AND COLUMN_NAME = N'relationship'
`);

if (width.recordset[0]?.max_len != null && width.recordset[0].max_len < 40) {
  await pool.request().query(`
    ALTER TABLE dbo.family_members
      ALTER COLUMN relationship NVARCHAR(40) NOT NULL
  `);
  console.log("relationship column widened to NVARCHAR(40)");
} else {
  console.log("relationship column width is already sufficient");
}

const ck = await pool.request().query(`
  SELECT 1 AS ok
  FROM sys.check_constraints
  WHERE name = N'CK_family_members_relationship'
    AND parent_object_id = OBJECT_ID(N'dbo.family_members')
`);

if (ck.recordset[0]) {
  await pool.request().query(`
    ALTER TABLE dbo.family_members
      DROP CONSTRAINT CK_family_members_relationship
  `);
  console.log("dropped CK_family_members_relationship");
}

await pool.request().query(`
  ALTER TABLE dbo.family_members
    ADD CONSTRAINT CK_family_members_relationship
    CHECK (
      relationship IN (
        N'wife', N'husband',
        N'daughter', N'son',
        N'daughter_in_law', N'son_in_law',
        N'granddaughter', N'grandson',
        N'great_granddaughter', N'great_grandson',
        N'other'
      )
    )
`);
console.log("CK_family_members_relationship updated");

await pool.close();
