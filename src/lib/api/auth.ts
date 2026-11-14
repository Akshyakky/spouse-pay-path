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

    const identifier = data.identifier.trim();
    const email = loginIdentifierToEmail(identifier);
    const username = (
      identifier.includes("@") ? identifier.slice(0, identifier.indexOf("@")) : identifier
    ).toLowerCase();
    const compact = username.replace(/[^a-z0-9]/g, "");
    const user = await queryOne<{
      id: string;
      email: string;
      username: string | null;
      full_name: string | null;
      password_hash: string | null;
      is_active: boolean;
      session_epoch: number;
    }>(
      `SELECT id, email, username, full_name, password_hash, is_active, session_epoch
       FROM users
       WHERE is_active
         AND (
           LOWER(email) = LOWER(@email)
           OR LOWER(username) = LOWER(@username)
           OR (
             @compact <> ''
             AND LOWER(REGEXP_REPLACE(COALESCE(username, ''), '[^a-zA-Z0-9]', '', 'g')) = @compact
           )
         )
       ORDER BY CASE
         WHEN LOWER(username) = LOWER(@username) THEN 0
         WHEN LOWER(email) = LOWER(@email) THEN 1
         ELSE 2
       END
       LIMIT 1`,
      { email, username, compact },
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

    await startSession(sessionUser, Number(user.session_epoch));
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

export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        currentPassword: z.string().min(1).max(72),
        newPassword: z.string().min(8).max(72),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.currentPassword === data.newPassword) {
      throw new Error("New password must be different from the current password");
    }
    const bcrypt = (await import("bcryptjs")).default;
    const { queryOne } = await import("@/lib/db");

    const user = await queryOne<{ password_hash: string | null; app_role: string | null }>(
      `SELECT password_hash, app_role FROM users WHERE id = @userId AND is_active`,
      { userId: context.userId },
    );
    if (!user?.password_hash) throw new Error("Account not found");

    const ok = await bcrypt.compare(data.currentPassword, user.password_hash);
    if (!ok) throw new Error("Current password is incorrect");

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    const { encryptSecret } = await import("@/lib/secret-box");
    const passwordReveal = user.app_role === "family" ? encryptSecret(data.newPassword) : null;
    const { startSession } = await import("@/lib/session");
    const updated = await queryOne<{ session_epoch: number }>(
      `UPDATE users
       SET password_hash = @hash,
           password_reveal = COALESCE(@reveal, password_reveal),
           session_epoch = session_epoch + 1
       WHERE id = @userId
       RETURNING session_epoch`,
      { hash: passwordHash, reveal: passwordReveal, userId: context.userId },
    );
    await startSession(context.user, Number(updated?.session_epoch ?? 1));
    return { ok: true };
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
