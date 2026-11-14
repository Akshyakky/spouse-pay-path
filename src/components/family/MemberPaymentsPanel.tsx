import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getFamilyMemberPayments, type MemberPaymentGroup } from "@/lib/api/payments";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatMoney } from "@/lib/auth";
import { relationshipLabel } from "@/lib/relationships";
import { cn } from "@/lib/utils";

export function MemberPaymentsPanel({
  familyId,
  from,
  to,
  memberId,
  showEmptyMembers = true,
  variant = "detail",
  title = "Payments by member",
}: {
  familyId: string;
  from?: string | undefined;
  to?: string | undefined;
  memberId?: string | undefined;
  showEmptyMembers?: boolean | undefined;
  variant?: "detail" | "summary" | undefined;
  title?: string | undefined;
}) {
  const query = useQuery({
    queryKey: ["member-payments", familyId, from ?? null, to ?? null],
    queryFn: () =>
      getFamilyMemberPayments({
        data: {
          familyId,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      }),
  });

  const members = (query.data?.members ?? []).filter(
    (m) => showEmptyMembers || m.paymentCount > 0,
  );
  const unassigned = query.data?.unassigned ?? null;
  const allGroups = unassigned ? [...members, unassigned] : members;
  const groups = memberId ? allGroups.filter((g) => g.memberId === memberId) : allGroups;
  const totals = memberId
    ? groups[0] ?? {
        memberId,
        fullName: "",
        relationship: null,
        isHead: false,
        approved: 0,
        pending: 0,
        rejected: 0,
        paymentCount: 0,
        payments: [],
      }
    : query.data?.totals;

  return (
    <section className={variant === "summary" ? undefined : "surface p-6"}>
      <h2 className="text-base font-semibold">{title}</h2>
      {totals ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Approved {formatMoney(totals.approved)}
          {totals.pending > 0 ? ` · Pending ${formatMoney(totals.pending)}` : ""}
          {totals.paymentCount ? ` · ${totals.paymentCount} payment${totals.paymentCount === 1 ? "" : "s"}` : ""}
        </p>
      ) : null}

      {query.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading member payments…</p>
      ) : groups.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No payments recorded for members in this period.</p>
      ) : variant === "summary" ? (
        <MemberTotalsTable groups={groups} />
      ) : (
        <Accordion type="multiple" className="mt-4">
          {groups.map((group) => (
            <AccordionItem key={group.memberId ?? "unassigned"} value={group.memberId ?? "unassigned"}>
              <AccordionTrigger className="hover:no-underline">
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pr-3 text-left">
                  <span className="min-w-0">
                    <span className="font-medium">{group.fullName}</span>
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {group.memberId
                        ? `${relationshipLabel(group.relationship)}${group.isHead ? " · Head" : ""}`
                        : "No member selected"}
                    </span>
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {formatMoney(group.approved)}
                    {group.pending > 0 ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        pending {formatMoney(group.pending)}
                      </span>
                    ) : null}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {group.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded for this member.</p>
                ) : (
                  <div className="divide-y divide-border rounded-md border border-border">
                    {group.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                      >
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
                            {!group.memberId && p.paid_by ? ` · ${p.paid_by}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium tabular-nums">{formatMoney(p.amount)}</span>
                          <StatusBadge status={p.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </section>
  );
}

function MemberTotalsTable({ groups }: { groups: MemberPaymentGroup[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Member</th>
            <th className="py-2 pr-3 font-medium">Relationship</th>
            <th className="py-2 pr-3 text-right font-medium">Approved</th>
            <th className="py-2 pr-3 text-right font-medium">Pending</th>
            <th className="py-2 text-right font-medium">Payments</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {groups.map((group) => (
            <tr key={group.memberId ?? "unassigned"}>
              <td className="py-2 pr-3 font-medium">{group.fullName}</td>
              <td className="py-2 pr-3 text-muted-foreground">
                {group.memberId ? relationshipLabel(group.relationship) : "—"}
              </td>
              <td className={cn("py-2 pr-3 text-right tabular-nums", group.approved > 0 && "text-success")}>
                {formatMoney(group.approved)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                {group.pending > 0 ? formatMoney(group.pending) : "—"}
              </td>
              <td className="py-2 text-right tabular-nums">{group.paymentCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
