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
  SELECT COL_LENGTH(N'dbo.family_members', N'address') AS col_len
`);

if (exists.recordset[0]?.col_len == null) {
  await pool.request().query(`
    ALTER TABLE dbo.family_members ADD address NVARCHAR(500) NULL
  `);
  console.log("address column added to family_members");
} else {
  console.log("address column already exists on family_members");
}

await pool.close();
