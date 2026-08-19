import sql from "mssql";
import { toDateString, toIsoString } from "@/lib/db-utils";

export { toDateString, toIsoString };

let poolPromise: Promise<sql.ConnectionPool> | undefined;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool({
      server: requireEnv("MSSQL_SERVER"),
      database: requireEnv("MSSQL_DATABASE"),
      user: requireEnv("MSSQL_USER"),
      password: requireEnv("MSSQL_PASSWORD"),
      options: {
        encrypt: process.env.MSSQL_ENCRYPT === "true",
        trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE !== "false",
      },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    })
      .connect()
      .catch((err) => {
        poolPromise = undefined;
        throw err;
      });
  }
  return poolPromise;
}

export { sql };

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: Record<string, unknown>,
): Promise<T[]> {
  const pool = await getPool();
  const request = pool.request();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value as never);
    }
  }
  const result = await request.query<T>(text);
  return result.recordset ?? [];
}

export async function queryOne<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: Record<string, unknown>,
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function execute(text: string, params?: Record<string, unknown>): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value as never);
    }
  }
  const result = await request.query(text);
  return result.rowsAffected[0] ?? 0;
}
