import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { getSessionUser, login } from "@/lib/api/auth";
import { OrgContactText, OrgMark } from "@/components/OrgBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ORG, orgPageTitle } from "@/lib/org";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: orgPageTitle("Sign in") },
      {
        name: "description",
        content: `Sign in to ${ORG.name}.`,
      },
      { property: "og:title", content: orgPageTitle("Sign in") },
      {
        property: "og:description",
        content: `Sign in to ${ORG.name}.`,
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
      <div className="hero-gradient hidden flex-col justify-center gap-8 p-10 text-primary-foreground lg:flex">
        <OrgMark />
        <OrgContactText prefix="For help:" className="text-xs text-primary-foreground/60" />
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <OrgMark />
          </div>
          <h1 className="text-2xl font-semibold">Sign in</h1>

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
          <OrgContactText prefix="For help:" className="mt-6 text-xs text-muted-foreground lg:hidden" />
        </div>
      </div>
    </div>
  );
}
