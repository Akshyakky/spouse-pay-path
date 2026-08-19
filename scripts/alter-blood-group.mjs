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
  SELECT COL_LENGTH(N'dbo.family_members', N'blood_group') AS col_len
`);

if (exists.recordset[0]?.col_len == null) {
  await pool.request().query(`
    ALTER TABLE dbo.family_members ADD blood_group NVARCHAR(10) NULL
  `);
  await pool.request().query(`
    ALTER TABLE dbo.family_members
      ADD CONSTRAINT CK_family_members_blood_group
      CHECK (
        blood_group IS NULL
        OR blood_group IN (N'A+', N'A-', N'B+', N'B-', N'AB+', N'AB-', N'O+', N'O-')
      )
  `);
  console.log("blood_group column added");
} else {
  console.log("blood_group column already exists");
}

await pool.close();
