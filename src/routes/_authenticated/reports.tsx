import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getReport } from "@/lib/api/expenses";
import { listFamiliesLite } from "@/lib/api/families";
import { AppShell, StatCard } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMoney, todayLocalDate, useRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrgLetterhead } from "@/components/OrgBrand";
import { orgPageTitle } from "@/lib/org";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: orgPageTitle("Reports") },
      { name: "description", content: "Credit, debit and balance reports for any date range." },
      { property: "og:title", content: orgPageTitle("Reports") },
      { property: "og:description", content: "Credit, debit and balance reports." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

const ALL_FAMILIES = "all";

function ReportsPage() {
  const { isAdmin } = useRole();
  const today = todayLocalDate();
  const firstOfYear = `${new Date().getFullYear()}-01-01`;
  const [from, setFrom] = useState(firstOfYear);
  const [to, setTo] = useState(today);
  const [familyKey, setFamilyKey] = useState(ALL_FAMILIES);

  const families = useQuery({
    queryKey: ["families-lite"],
    enabled: isAdmin,
    queryFn: () => listFamiliesLite(),
  });

  const reportFamilyId = isAdmin && familyKey !== ALL_FAMILIES ? familyKey : null;

  const report = useQuery({
    queryKey: ["report", from, to, isAdmin, reportFamilyId],
    queryFn: () =>
      getReport({
        data: reportFamilyId ? { from, to, familyId: reportFamilyId } : { from, to },
      }),
  });

  const credit = (report.data?.payments ?? [])
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const debit = (report.data?.expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <AppShell title="Reports" description="Filter by period and print a statement">
      <div className="surface p-6 print:shadow-none">
        <OrgLetterhead className="mb-6 border-b border-border pb-4" />
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
          {isAdmin ? (
            <div className="space-y-2">
              <Label>Family</Label>
              <Select value={familyKey} onValueChange={setFamilyKey}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FAMILIES}>All families</SelectItem>
                  {(families.data ?? []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.family_no} · {f.family_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <Button type="button" variant="outline" onClick={() => window.print()}>
            Print report
          </Button>
        </form>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Credit" value={formatMoney(credit)} tone="credit" />
          <StatCard
            label="Debit"
            value={formatMoney(debit)}
            tone="debit"
            hint={isAdmin ? undefined : "Expenses assigned to your family"}
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

        <h2 className="mt-8 text-base font-semibold">Expenses</h2>
        <div className="mt-3 divide-y divide-border">
          {(report.data?.expenses ?? []).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="font-medium">{e.category}</span>
              <span className="text-muted-foreground">
                {e.expense_date}
                {isAdmin
                  ? e.family_no
                    ? ` · ${e.family_no}`
                    : " · Shared"
                  : ""}
              </span>
              <span className="font-medium text-destructive">{formatMoney(e.amount)}</span>
            </div>
          ))}
          {(report.data?.expenses ?? []).length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No expenses in this period.</p>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
