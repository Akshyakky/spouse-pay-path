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
    `SELECT id FROM users WHERE LOWER(email) = LOWER(@email)`,
    { email: input.email },
  );
  if (existing) throw new Error("A user with that email/username already exists");

  const passwordHash = await bcrypt.hash(input.password, 10);
  const row = await queryOne<{ id: string }>(
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
