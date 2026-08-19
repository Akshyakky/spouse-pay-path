import { useSession } from "@tanstack/react-start/server";

export type SessionUser = {
  id: string;
  email: string;
  username: string | null;
  fullName: string | null;
};

export type AppSessionData = {
  user: SessionUser;
};

const COOKIE_NAME = "spp_session";

function sessionPassword(): string {
  const secret = process.env.SESSION_SECRET ?? "spouse-pay-path-dev-session-secret-min-32-chars";
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}

export async function getAppSession() {
  return useSession<AppSessionData>({
    name: COOKIE_NAME,
    password: sessionPassword(),
    maxAge: 60 * 60 * 24 * 14, // 14 days
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    },
  });
}

export async function requireSessionUser(): Promise<SessionUser> {
  const session = await getAppSession();
  const user = session.data.user;
  if (!user?.id) throw new Error("Unauthorized");
  return user;
}
