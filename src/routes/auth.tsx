import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { loginIdentifierToEmail } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search['mode'] === "register" ? ("register" as const) : ("login" as const),
  }),
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

const registerSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  fullName: z.string().trim().min(2, "Enter your name").max(120),
});

function AuthPage() {
  const navigate = useNavigate();
  const { mode } = Route.useSearch();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
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
    const { error } = await supabase.auth.signInWithPassword({
      email: loginIdentifierToEmail(parsed.data.identifier),
      password: parsed.data.password,
    });
    setBusy(false);
    if (error) {
      toast.error("Invalid username or password");
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = registerSchema.safeParse({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      fullName: String(form.get("fullName") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: parsed.data.fullName },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Account created. Check your email to confirm, then sign in.");
      return;
    }
    toast.success("Account created");
    navigate({ to: "/dashboard", replace: true });
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

          <Tabs defaultValue={mode} className="mt-8">
            <TabsList className="w-full">
              <TabsTrigger value="login" className="flex-1">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="register" className="flex-1">
                Admin setup
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
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
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 pt-4">
                <p className="rounded-lg bg-secondary p-3 text-xs text-secondary-foreground">
                  The first account created becomes the administrator. Further administrators are
                  added from inside the app, and family logins are issued by an admin.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" name="fullName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Password</Label>
                  <Input
                    id="newPassword"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
