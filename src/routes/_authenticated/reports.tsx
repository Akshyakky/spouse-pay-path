import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getReport } from "@/lib/api/expenses";
import { AppShell, StatCard } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMoney, useRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Family Payment Tracking System" },
      { name: "description", content: "Credit, debit and balance reports for any date range." },
      { property: "og:title", content: "Reports — Family Payment Tracking System" },
      { property: "og:description", content: "Credit, debit and balance reports." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { isAdmin } = useRole();
  const today = new Date().toISOString().slice(0, 10);
  const firstOfYear = `${new Date().getFullYear()}-01-01`;
  const [from, setFrom] = useState(firstOfYear);
  const [to, setTo] = useState(today);

  const report = useQuery({
    queryKey: ["report", from, to, isAdmin],
    queryFn: () => getReport({ data: { from, to } }),
  });

  const credit = (report.data?.payments ?? [])
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const debit = (report.data?.expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <AppShell title="Reports" description="Filter by period and print a statement">
      <div className="surface p-6 print:shadow-none">
        <form
          className="flex flex-wrap items-end gap-3 print:hidden"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={() => window.print()}>
            Print report
          </Button>
        </form>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Credit" value={formatMoney(credit)} tone="credit" />
          <StatCard
            label="Debit"
            value={isAdmin ? formatMoney(debit) : "—"}
            tone="debit"
            hint={isAdmin ? undefined : "Admin only"}
          />
          <StatCard label="Balance" value={formatMoney(credit - debit)} />
        </div>

        <h2 className="mt-8 text-base font-semibold">Payments</h2>
        <div className="mt-3 divide-y divide-border">
          {(report.data?.payments ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="font-medium">{p.voucher_no}</span>
              <span className="text-muted-foreground">{p.payment_date}</span>
              <StatusBadge status={p.status} />
              <span className="font-medium">{formatMoney(p.amount)}</span>
            </div>
          ))}
          {(report.data?.payments ?? []).length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No payments in this period.</p>
          ) : null}
        </div>

        {isAdmin ? (
          <>
            <h2 className="mt-8 text-base font-semibold">Expenses</h2>
            <div className="mt-3 divide-y divide-border">
              {(report.data?.expenses ?? []).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="font-medium">{e.category}</span>
                  <span className="text-muted-foreground">{e.expense_date}</span>
                  <span className="font-medium text-destructive">{formatMoney(e.amount)}</span>
                </div>
              ))}
              {(report.data?.expenses ?? []).length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No expenses in this period.</p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
