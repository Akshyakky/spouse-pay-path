import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { getSessionUser, login } from "@/lib/api/auth";
import { loginIdentifierToEmail } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Family Payment Tracking System" },
      {
        name: "description",
        content:
          "Sign in as an administrator or with the family username issued by the admin to manage family payments and vouchers.",
      },
      { property: "og:title", content: "Sign in — Family Payment Tracking System" },
      {
        property: "og:description",
        content: "Secure login for administrators and the family user.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your username or email").max(255),
  password: z.string().min(6, "Enter your password").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSessionUser().then((user) => {
      if (user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({
      identifier: String(form.get("identifier") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setBusy(true);
    try {
      // Normalize identifier the same way as before (email or username@family.local)
      void loginIdentifierToEmail(parsed.data.identifier);
      await login({
        data: {
          identifier: parsed.data.identifier,
          password: parsed.data.password,
        },
      });
      toast.success("Welcome back");
      navigate({ to: "/dashboard", replace: true });
    } catch {
      toast.error("Invalid username or password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hero-gradient hidden flex-col justify-between p-10 text-primary-foreground lg:flex">
        <Link to="/" className="font-display text-base font-semibold">
          Family Payments
        </Link>
        <div>
          <h2 className="max-w-sm text-3xl font-semibold leading-tight">
            Payments, vouchers and approvals in one secure place.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-primary-foreground/80">
            Administrators manage families, approvals, expenses and reports. The family user signs
            in with the username issued by the admin.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">Family Payment Tracking System</p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Family users sign in with their username. Administrators use their email address.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Username or email</Label>
              <Input id="identifier" name="identifier" autoComplete="username" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 rounded-lg bg-secondary p-3 text-xs text-secondary-foreground">
            Accounts are not self-service. Administrators are added from inside the app by an
            existing admin, and family logins are issued by an admin.
          </p>
        </div>
      </div>
    </div>
  );
}
