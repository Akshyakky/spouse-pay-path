import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getReport } from "@/lib/api/expenses";
import { listFamiliesLite, listFamilyMembers } from "@/lib/api/families";
import { relationshipLabel } from "@/lib/relationships";
import { AppShell, StatCard } from "@/components/AppShell";
import { MemberPaymentsPanel } from "@/components/family/MemberPaymentsPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMoney, todayLocalDate, useMyFamily, useRole } from "@/lib/auth";
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
const ALL_MEMBERS = "all";

function ReportsPage() {
  const { isAdmin } = useRole();
  const myFamily = useMyFamily();
  const today = todayLocalDate();
  const firstOfYear = `${new Date().getFullYear()}-01-01`;
  const [from, setFrom] = useState(firstOfYear);
  const [to, setTo] = useState(today);
  const [familyKey, setFamilyKey] = useState(ALL_FAMILIES);
  const [memberKey, setMemberKey] = useState(ALL_MEMBERS);

  const families = useQuery({
    queryKey: ["families-lite"],
    enabled: isAdmin,
    queryFn: () => listFamiliesLite(),
  });

  const reportFamilyId = isAdmin && familyKey !== ALL_FAMILIES ? familyKey : null;
  const memberFamilyId = isAdmin ? reportFamilyId : (myFamily.data?.id ?? null);

  useEffect(() => {
    setMemberKey(ALL_MEMBERS);
  }, [familyKey]);

  const familyMembers = useQuery({
    queryKey: ["family-members", memberFamilyId],
    enabled: !!memberFamilyId,
    queryFn: () => listFamilyMembers({ data: { familyId: memberFamilyId as string } }),
  });

  const report = useQuery({
    queryKey: ["report", from, to, isAdmin, reportFamilyId],
    queryFn: () =>
      getReport({
        data: reportFamilyId ? { from, to, familyId: reportFamilyId } : { from, to },
      }),
  });

  const reportPayments = (report.data?.payments ?? []).filter(
    (p) => memberKey === ALL_MEMBERS || p.paid_by_member_id === memberKey,
  );

  const credit = reportPayments
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
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="date"
              className="w-[12.5rem]"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="date"
              className="w-[12.5rem]"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          {isAdmin ? (
            <div className="min-w-[16rem] max-w-sm flex-1 space-y-1.5">
              <Label>Family</Label>
              <Select value={familyKey} onValueChange={setFamilyKey}>
                <SelectTrigger className="w-full">
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
          <div className="min-w-[16rem] max-w-sm flex-1 space-y-1.5">
            <Label>Paid by</Label>
            <Select
              value={memberKey}
              onValueChange={setMemberKey}
              disabled={!memberFamilyId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={memberFamilyId ? "All members" : "Select a family first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_MEMBERS}>All members</SelectItem>
                {(familyMembers.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name} · {relationshipLabel(m.relationship)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            className="shrink-0 bg-sidebar text-sidebar-foreground hover:bg-sidebar/90"
            onClick={() => window.print()}
          >
            Print report
          </Button>
        </form>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard plain label="Credit" value={formatMoney(credit)} tone="credit" />
          <StatCard
            plain
            label="Debit"
            value={formatMoney(debit)}
            tone="debit"
            hint={isAdmin ? undefined : "Expenses assigned to your family"}
          />
          <StatCard plain label="Balance" value={formatMoney(credit - debit)} />
        </div>

        {memberFamilyId ? (
          <div className="mt-8">
            <MemberPaymentsPanel
              familyId={memberFamilyId}
              from={from}
              to={to}
              {...(memberKey !== ALL_MEMBERS ? { memberId: memberKey } : {})}
              showEmptyMembers={false}
              variant="summary"
            />
          </div>
        ) : null}

        <h2 className="mt-8 text-base font-semibold">Payments</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Voucher</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Paid by</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reportPayments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-3 font-medium">{p.voucher_no}</td>
                  <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{p.payment_date}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{p.paid_by || "—"}</td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">{formatMoney(p.amount)}</td>
                </tr>
              ))}
              {reportPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-sm text-muted-foreground">
                    No payments in this period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-base font-semibold">Expenses</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                {isAdmin ? <th className="py-2 pr-3 font-medium">Family</th> : null}
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(report.data?.expenses ?? []).map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-3 font-medium">{e.category}</td>
                  <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{e.expense_date}</td>
                  {isAdmin ? (
                    <td className="py-2 pr-3 text-muted-foreground">{e.family_no || "Shared"}</td>
                  ) : null}
                  <td className="py-2 text-right font-medium tabular-nums text-destructive">
                    {formatMoney(e.amount)}
                  </td>
                </tr>
              ))}
              {(report.data?.expenses ?? []).length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3} className="py-4 text-sm text-muted-foreground">
                    No expenses in this period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
