import { useSession } from "@tanstack/react-start/server";

export type SessionUser = {
  id: string;
  email: string;
  username: string | null;
  fullName: string | null;
};

export type AppSessionData = {
  user: SessionUser;
  lastSeenAt: number;
};

const COOKIE_NAME = "spp_session";

/** Sign-in is required again after this much inactivity. */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** Avoid re-sealing the cookie on every single request while the user is active. */
const TOUCH_INTERVAL_MS = 60 * 1000;

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
    // No maxAge: the cookie has no Expires/Max-Age, so the browser drops it on
    // close and expiry is enforced by the idle check below instead.
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    },
  });
}

export async function startSession(user: SessionUser): Promise<void> {
  const session = await getAppSession();
  await session.update({ user, lastSeenAt: Date.now() });
}

export async function endSession(): Promise<void> {
  const session = await getAppSession();
  await session.clear();
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getAppSession();
  const user = session.data.user;
  if (!user?.id) return null;

  const now = Date.now();
  const lastSeenAt = session.data.lastSeenAt ?? 0;
  if (now - lastSeenAt > IDLE_TIMEOUT_MS) {
    await session.clear();
    return null;
  }

  if (now - lastSeenAt > TOUCH_INTERVAL_MS) {
    await session.update({ lastSeenAt: now });
  }
  return user;
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
