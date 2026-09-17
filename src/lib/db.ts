import { Pool, types, type PoolConfig } from "pg";

types.setTypeParser(types.builtins.DATE, (value) => value);
types.setTypeParser(types.builtins.NUMERIC, (value) => value);

const PARAM_RE = /@([A-Za-z_][A-Za-z0-9_]*)/g;

let pool: Pool | undefined;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function sslConfig(): PoolConfig["ssl"] {
  const url = process.env["DATABASE_URL"] ?? "";
  if (url.includes("sslmode=require") || url.includes("sslmode=verify-full") || url.includes("sslmode=verify-ca")) {
    return { rejectUnauthorized: false };
  }
  const mode = (process.env["PGSSL"] || process.env["PGSSLMODE"] || "").toLowerCase();
  if (mode === "disable" || mode === "false") return false;
  if (mode === "require" || mode === "true" || mode === "no-verify") {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function createPool(): Pool {
  const ssl = sslConfig();
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString) {
    return new Pool({
      connectionString,
      ssl,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }

  return new Pool({
    host: requireEnv("PGHOST"),
    port: Number(process.env["PGPORT"] || 5432),
    user: requireEnv("PGUSER"),
    password: requireEnv("PGPASSWORD"),
    database: requireEnv("PGDATABASE"),
    ssl,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

export function getPool(): Pool {
  if (!pool) pool = createPool();
  return pool;
}

function bindNamed(text: string, params?: Record<string, unknown>) {
  const values: unknown[] = [];
  const indexByName = new Map<string, number>();
  const bound = text.replace(PARAM_RE, (_match, name: string) => {
    let index = indexByName.get(name);
    if (index == null) {
      if (!params || !(name in params)) {
        throw new Error(`Missing SQL parameter: ${name}`);
      }
      values.push(params[name]);
      index = values.length;
      indexByName.set(name, index);
    }
    return `$${index}`;
  });
  return { text: bound, values };
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: Record<string, unknown>,
): Promise<T[]> {
  const bound = bindNamed(text, params);
  const result = await getPool().query<T>(bound.text, bound.values);
  return result.rows ?? [];
}

export async function queryOne<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: Record<string, unknown>,
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function execute(text: string, params?: Record<string, unknown>): Promise<number> {
  const bound = bindNamed(text, params);
  const result = await getPool().query(bound.text, bound.values);
  return result.rowCount ?? 0;
}
