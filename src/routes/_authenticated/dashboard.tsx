import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, StatCard } from "@/components/AppShell";
import { formatMoney, useMyFamily, useRole } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { getDashboardSummary, listPayments } from "@/lib/api/payments";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Family Payment Tracking System" },
      {
        name: "description",
        content: "Credit, debit, balance and pending approvals at a glance.",
      },
      { property: "og:title", content: "Dashboard — Family Payment Tracking System" },
      { property: "og:description", content: "Credit, debit and balance overview." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { isAdmin, loading } = useRole();
  const myFamily = useMyFamily();

  const summary = useQuery({
    queryKey: ["summary", isAdmin, myFamily.data?.id],
    enabled: !loading && (isAdmin || !!myFamily.data?.id || myFamily.isFetched),
    queryFn: () => getDashboardSummary(),
  });

  const recent = useQuery({
    queryKey: ["recent-payments"],
    queryFn: () => listPayments({ data: { limit: 6 } }),
  });

  const s = summary.data;

  return (
    <AppShell
      title={isAdmin ? "Administrator dashboard" : "Family dashboard"}
      description={
        isAdmin
          ? "All families, payments, expenses and balances"
          : myFamily.data
            ? `Family ${myFamily.data.family_no} — ${myFamily.data.family_name}`
            : "Your family record has not been linked yet"
      }
      actions={
        <Button asChild size="sm">
          <Link to="/payments">{isAdmin ? "Review payments" : "Add payment"}</Link>
        </Button>
      }
    >
      {!isAdmin && myFamily.isFetched && !myFamily.data ? (
        <div className="surface mb-6 p-5 text-sm text-muted-foreground">
          Your login is not linked to a family record yet. Please ask the administrator to link it.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total credit"
          value={formatMoney(s?.credit)}
          hint="Approved payments"
          tone="credit"
        />
        <StatCard
          label="Total debit"
          value={isAdmin ? formatMoney(s?.debit) : "—"}
          hint={isAdmin ? "Expenses recorded" : "Visible to admin"}
          tone="debit"
        />
        <StatCard
          label="Balance"
          value={isAdmin ? formatMoney((s?.credit ?? 0) - (s?.debit ?? 0)) : formatMoney(s?.credit)}
          hint={isAdmin ? "Credit minus debit" : "Approved total"}
        />
        <StatCard
          label="Pending approval"
          value={String(s?.pendingCount ?? 0)}
          hint={`${formatMoney(s?.pendingAmount)} awaiting review`}
        />
      </div>

      <section className="surface mt-6 p-6">
        <h2 className="text-base font-semibold">Recent payments</h2>
        <div className="mt-4 divide-y divide-border">
          {(recent.data ?? []).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <Link
                  to="/vouchers/$id"
                  params={{ id: p.id }}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {p.voucher_no}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {p.payment_date} · {p.mode === "cash" ? "Cash" : "Online transfer"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium">{formatMoney(p.amount)}</span>
                <StatusBadge status={p.status} />
              </div>
            </div>
          ))}
          {(recent.data ?? []).length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
