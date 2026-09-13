import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/auth-middleware";
import { loginIdentifierToEmail } from "@/lib/auth-utils";

export type AppRole = "admin" | "family";

export type SessionUserDto = {
  id: string;
  email: string;
  username: string | null;
  fullName: string | null;
};

export const login = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        identifier: z.string().trim().min(3).max(255),
        password: z.string().min(6).max(72),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const bcrypt = (await import("bcryptjs")).default;
    const { queryOne } = await import("@/lib/db");
    const { startSession } = await import("@/lib/session");

    const email = loginIdentifierToEmail(data.identifier);
    const user = await queryOne<{
      id: string;
      email: string;
      username: string | null;
      full_name: string | null;
      password_hash: string | null;
      is_active: boolean;
    }>(
      `SELECT id, email, username, full_name, password_hash, is_active
       FROM users
       WHERE LOWER(email) = LOWER(@email)`,
      { email },
    );

    if (!user || !user.is_active || !user.password_hash) {
      throw new Error("Invalid username or password");
    }

    const ok = await bcrypt.compare(data.password, user.password_hash);
    if (!ok) throw new Error("Invalid username or password");

    const sessionUser: SessionUserDto = {
      id: String(user.id),
      email: user.email,
      username: user.username,
      fullName: user.full_name,
    };

    await startSession(sessionUser);
    return { user: sessionUser };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { endSession } = await import("@/lib/session");
  await endSession();
  return { ok: true };
});

export const getSessionUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser: readSessionUser } = await import("@/lib/session");
  return readSessionUser();
});

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<AppRole> => {
    return context.isAdmin ? "admin" : "family";
  });

export const getMyFamily = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { queryOne } = await import("@/lib/db");
    const { mapFamily } = await import("@/lib/api/mappers");
    const row = await queryOne(
      `SELECT f.id, f.family_no, f.family_name, f.address, f.contact_phone, f.contact_email,
              f.family_photo_url, f.wife_user_id, f.created_by, f.created_at, f.updated_at,
              h.full_name AS head_of_family
       FROM families f
       LEFT JOIN family_members h ON h.family_id = f.id AND h.is_head
       WHERE f.wife_user_id = @userId`,
      { userId: context.userId },
    );
    if (!row) return null;
    return mapFamily(row);
  });
