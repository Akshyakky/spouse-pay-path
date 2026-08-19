import { createMiddleware } from "@tanstack/react-start";
import type { SessionUser } from "@/lib/session";

export type AuthContext = {
  user: SessionUser;
  userId: string;
  isAdmin: boolean;
};

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { requireSessionUser } = await import("@/lib/session");
  const { queryOne } = await import("@/lib/db");

  const user = await requireSessionUser();

  const roleRow = await queryOne<{ role: string }>(
    `SELECT TOP 1 role FROM dbo.user_roles WHERE user_id = @userId AND role = N'admin'`,
    { userId: user.id },
  );

  return next({
    context: {
      user,
      userId: user.id,
      isAdmin: !!roleRow,
    } satisfies AuthContext,
  });
});

export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireAuth])
  .server(async ({ next, context }) => {
    if (!context.isAdmin) throw new Error("Forbidden: admin only");
    return next({ context });
  });
