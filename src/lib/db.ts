import { Pool, types, type PoolConfig } from "pg";

types.setTypeParser(types.builtins.DATE, (value) => value);
types.setTypeParser(types.builtins.NUMERIC, (value) => value);

const PARAM_RE = /@([A-Za-z_][A-Za-z0-9_]*)/g;

let pool: Pool | undefined;
let schemaReady: Promise<void> | null = null;

export type DbSql = {
  query: typeof query;
  queryOne: typeof queryOne;
  execute: typeof execute;
};

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

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_epoch INTEGER NOT NULL DEFAULT 1`)
      .then(() =>
        getPool().query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reveal TEXT NULL`),
      )
      .then(() =>
        getPool().query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_by_member_id UUID NULL`),
      )
      .then(() =>
        getPool().query(
          `CREATE INDEX IF NOT EXISTS ix_payments_paid_by_member_id ON payments (paid_by_member_id)`,
        ),
      )
      .then(() =>
        getPool().query(`
          DO $$ BEGIN
            ALTER TABLE payments
              ADD CONSTRAINT fk_payments_paid_by_member
              FOREIGN KEY (paid_by_member_id) REFERENCES family_members(id) ON DELETE SET NULL;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$;
        `),
      )
      .then(() =>
        getPool().query(`
          UPDATE payments p
          SET paid_by_member_id = m.id
          FROM family_members m
          WHERE p.paid_by_member_id IS NULL
            AND p.paid_by IS NOT NULL
            AND TRIM(p.paid_by) <> ''
            AND m.family_id = p.family_id
            AND LOWER(TRIM(m.full_name)) = LOWER(TRIM(p.paid_by))
            AND NOT EXISTS (
              SELECT 1 FROM family_members m2
              WHERE m2.family_id = p.family_id
                AND m2.id <> m.id
                AND LOWER(TRIM(m2.full_name)) = LOWER(TRIM(p.paid_by))
            )
        `),
      )
      .then(() => undefined)
      .catch((err) => {
        schemaReady = null;
        throw err;
      });
  }
  await schemaReady;
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
  await ensureSchema();
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
  await ensureSchema();
  const bound = bindNamed(text, params);
  const result = await getPool().query(bound.text, bound.values);
  return result.rowCount ?? 0;
}

export async function withTransaction<T>(fn: (sql: DbSql) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const runQuery = async <R extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      params?: Record<string, unknown>,
    ): Promise<R[]> => {
      const bound = bindNamed(text, params);
      const result = await client.query<R>(bound.text, bound.values);
      return result.rows ?? [];
    };
    const sql: DbSql = {
      query: runQuery,
      queryOne: async (text, params) => {
        const rows = await runQuery(text, params);
        return rows[0] ?? null;
      },
      execute: async (text, params) => {
        const bound = bindNamed(text, params);
        const result = await client.query(bound.text, bound.values);
        return result.rowCount ?? 0;
      },
    };
    const result = await fn(sql);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The original error is more useful than a rollback failure.
    }
    throw err;
  } finally {
    client.release();
  }
}
