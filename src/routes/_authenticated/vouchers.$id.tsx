import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPaymentById } from "@/lib/api/payments";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { PrivateFileLink } from "@/components/PrivateImage";
import { formatMoney } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/vouchers/$id")({
  head: () => ({
    meta: [
      { title: "Payment voucher / receipt — Family Payment Tracking System" },
      { name: "description", content: "Printable payment voucher or official receipt after approval." },
      { property: "og:title", content: "Payment voucher / receipt — Family Payment Tracking System" },
      { property: "og:description", content: "Printable payment voucher or receipt." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VoucherPage,
});

function VoucherPage() {
  const { id } = Route.useParams();

  const voucher = useQuery({
    queryKey: ["voucher", id],
    queryFn: () => getPaymentById({ data: { id } }),
  });

  const p = voucher.data?.payment;
  const isReceipt = p?.status === "approved";
  const docTitle = isReceipt ? "Payment receipt" : "Payment voucher";

  return (
    <AppShell
      title={docTitle}
      description={p?.voucher_no}
      actions={
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Print
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/payments">Back</Link>
          </Button>
        </div>
      }
    >
      {p ? (
        <article className="surface mx-auto max-w-2xl p-8">
          <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 className="font-display text-xl font-semibold">{docTitle}</h2>
              <p className="text-sm text-muted-foreground">{p.voucher_no}</p>
              {isReceipt ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Official acknowledgement of payment received
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Payment submitted for review — not a final receipt yet
                </p>
              )}
            </div>
            <StatusBadge status={p.status} />
          </header>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2 text-sm">
            <Row
              label="Family"
              value={`${voucher.data?.family?.family_no ?? ""} ${voucher.data?.family?.family_name ?? ""}`}
            />
            {voucher.data?.dueTitle ? (
              <Row label="Toward due" value={voucher.data.dueTitle} />
            ) : null}
            <Row label="Payment date" value={p.payment_date} />
            <Row label="Amount" value={formatMoney(p.amount)} />
            <Row label="Mode" value={p.mode === "cash" ? "Cash" : "Online transfer"} />
            <Row label="Transaction reference" value={p.txn_ref ?? "—"} />
            <Row label="Paid by" value={p.paid_by ?? "—"} />
            <Row label="Remarks" value={p.remarks ?? "—"} />
            <Row
              label={isReceipt ? "Receipt issued on" : "Approved on"}
              value={p.approved_at ? new Date(p.approved_at).toLocaleString() : "Pending"}
            />
          </dl>

          {p.admin_remarks ? (
            <p className="mt-4 text-sm text-muted-foreground">Admin note: {p.admin_remarks}</p>
          ) : null}

          {p.screenshot_url ? (
            <div className="mt-4 print:hidden">
              <PrivateFileLink path={p.screenshot_url} label="View payment proof" />
            </div>
          ) : null}

          <footer className="mt-10 flex justify-between border-t border-border pt-6 text-xs text-muted-foreground">
            <span>Family signature</span>
            <span>Authorised signatory</span>
          </footer>
        </article>
      ) : (
        <p className="text-sm text-muted-foreground">Loading {isReceipt ? "receipt" : "voucher"}…</p>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
