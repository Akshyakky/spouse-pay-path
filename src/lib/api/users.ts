import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";

export async function createUserRecord(input: {
  email: string;
  username?: string | null;
  fullName?: string | null;
  password: string;
  appRole: "admin" | "family";
}): Promise<string> {
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM dbo.users WHERE LOWER(email) = LOWER(@email)`,
    { email: input.email },
  );
  if (existing) throw new Error("A user with that email/username already exists");

  const passwordHash = await bcrypt.hash(input.password, 10);
  // OUTPUT ... INTO is required: dbo.users has trg_users_after_insert
  const row = await queryOne<{ id: string }>(
    `DECLARE @inserted TABLE (id UNIQUEIDENTIFIER);
     INSERT INTO dbo.users (email, username, full_name, password_hash, app_role)
     OUTPUT INSERTED.id INTO @inserted
     VALUES (@email, @username, @fullName, @passwordHash, @appRole);
     SELECT id FROM @inserted;`,
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
