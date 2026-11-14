import bcrypt from "bcryptjs";
import { queryOne, type DbSql } from "@/lib/db";

const familyLoginWhere = `
  COALESCE(u.app_role, 'family') = 'family'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'admin'
  )
`;

export async function createUserRecord(
  input: {
    email: string;
    username?: string | null;
    fullName?: string | null;
    password: string;
    appRole: "admin" | "family";
  },
  sql?: Pick<DbSql, "queryOne">,
): Promise<string> {
  const db = sql ?? { queryOne };
  const existing = await db.queryOne<{ id: string }>(
    `SELECT id FROM users WHERE LOWER(email) = LOWER(@email)`,
    { email: input.email },
  );
  if (existing) throw new Error("A user with that email/username already exists");

  const passwordHash = await bcrypt.hash(input.password, 10);
  const row = await db.queryOne<{ id: string }>(
    `INSERT INTO users (email, username, full_name, password_hash, app_role)
     VALUES (@email, @username, @fullName, @passwordHash, @appRole)
     RETURNING id`,
    {
      email: input.email.toLowerCase(),
      username: input.username ?? null,
      fullName: input.fullName ?? "",
      passwordHash,
      appRole: input.appRole,
    },
  );
  if (!row?.id) throw new Error("Could not create user");
  return String(row.id);
}

export async function getFamilyLoginUserId(
  familyId: string,
  sql?: Pick<DbSql, "queryOne">,
): Promise<string> {
  const db = sql ?? { queryOne };
  const row = await db.queryOne<{ wife_user_id: string | null }>(
    `SELECT wife_user_id FROM families WHERE id = @familyId`,
    { familyId },
  );
  if (!row) throw new Error("Family not found");
  if (!row.wife_user_id) throw new Error("This family has no login");

  const user = await db.queryOne<{ id: string }>(
    `SELECT u.id FROM users u WHERE u.id = @userId AND ${familyLoginWhere}`,
    { userId: row.wife_user_id },
  );
  if (!user) throw new Error("Password reset and lock-out apply only to family logins");
  return String(user.id);
}

export async function deactivateFamilyLogin(
  userId: string,
  options: { clearPassword?: boolean } | undefined,
  sql: Pick<DbSql, "execute">,
): Promise<void> {
  await sql.execute(
    `UPDATE users u
     SET is_active = FALSE,
         session_epoch = session_epoch + 1
         ${options?.clearPassword ? ", password_hash = NULL" : ""}
     WHERE u.id = @userId AND ${familyLoginWhere}`,
    { userId },
  );
}
