import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Wallet,
  BarChart3,
  LogOut,
  Menu,
  UserCircle,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { logout } from "@/lib/api/auth";
import { useRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; label: string; icon: typeof Users; admin?: boolean; family?: boolean };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/families", label: "Families", icon: Users, admin: true },
  { to: "/family", label: "My family", icon: UserCircle, family: true },
  { to: "/dues", label: "Dues", icon: ClipboardList },
  { to: "/payments", label: "Payments", icon: Receipt },
  { to: "/expenses", label: "Expenses", icon: Wallet, admin: true },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/admins", label: "Administrators", icon: ShieldCheck, admin: true },
];

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
}) {
  const { isAdmin, user, role } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const items = NAV.filter((item) => (item.admin ? isAdmin : item.family ? !isAdmin : true));

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await logout();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:flex lg:translate-x-0",
          open ? "flex translate-x-0" : "hidden -translate-x-full lg:flex",
        )}
      >
        <div className="border-b border-sidebar-border px-5 py-5">
          <p className="font-display text-base font-semibold text-sidebar-accent-foreground">
            Family Payments
          </p>
          <p className="mt-1 text-xs text-sidebar-foreground/70">Tracking &amp; approvals</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border px-5 py-4">
          <p className="truncate text-xs text-sidebar-foreground/70">{user?.email}</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-sidebar-primary">
            {role === "admin" ? "Administrator" : "Family user"}
          </p>
          <button
            onClick={handleSignOut}
            className="mt-3 inline-flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-30 shrink-0 border-b border-border bg-background/80 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              <Menu className="size-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold sm:text-xl">{title}</h1>
              {description ? (
                <p className="truncate text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "default" | "credit" | "debit" | undefined;
}) {
  return (
    <div className="surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "stat-value mt-2",
          tone === "credit" && "text-success",
          tone === "debit" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
