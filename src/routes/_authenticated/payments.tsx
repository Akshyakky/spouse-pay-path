import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { listDemands, type FamilyDueRow } from "@/lib/api/dues";
import { listFamiliesLite, listFamilyMembers } from "@/lib/api/families";
import { relationshipLabel } from "@/lib/relationships";
import { createPayment, decidePayment, listPayments } from "@/lib/api/payments";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { PrivateFileLink } from "@/components/PrivateImage";
import { PaidBySelect } from "@/components/PaidBySelect";
import { formatMoney, todayLocalDate, uploadFile, useMyFamily, useRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orgPageTitle } from "@/lib/org";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: orgPageTitle("Payments") },
      { name: "description", content: "Submit payments, upload proof and track approvals." },
      { property: "og:title", content: orgPageTitle("Payments") },
      { property: "og:description", content: "Payment submissions and approvals." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentsPage,
});

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const NONE_DUE = "none";
const ALL_FAMILIES = "all";
const ALL_MEMBERS = "all";

const PAGE_SIZE = 50;

function PaymentsPage() {
  const { isAdmin } = useRole();
  const myFamily = useMyFamily();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [familyKey, setFamilyKey] = useState(ALL_FAMILIES);
  const [memberKey, setMemberKey] = useState(ALL_MEMBERS);
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();

  const families = useQuery({
    queryKey: ["families-lite"],
    enabled: isAdmin,
    queryFn: () => listFamiliesLite(),
  });

  const memberFamilyId = isAdmin
    ? familyKey !== ALL_FAMILIES
      ? familyKey
      : null
    : (myFamily.data?.id ?? null);

  useEffect(() => {
    setMemberKey(ALL_MEMBERS);
    setPage(0);
  }, [familyKey]);

  const familyMembers = useQuery({
    queryKey: ["family-members", memberFamilyId],
    enabled: !!memberFamilyId,
    queryFn: () => listFamilyMembers({ data: { familyId: memberFamilyId as string } }),
  });

  const payments = useQuery({
    queryKey: ["payments", status, page, familyKey, memberKey],
    queryFn: () =>
      listPayments({
        data: {
          status,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          ...(isAdmin && familyKey !== ALL_FAMILIES ? { familyId: familyKey } : {}),
          ...(memberKey !== ALL_MEMBERS ? { paidByMemberId: memberKey } : {}),
        },
      }),
  });

  const items = payments.data?.items ?? [];
  const total = payments.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  const decide = useMutation({
    mutationFn: async ({
      id,
      next,
      remarks,
    }: {
      id: string;
      next: "approved" | "rejected";
      remarks?: string;
    }) => {
      await decidePayment({
        data: { id, status: next, remarks: remarks ?? null },
      });
    },
    onSuccess: () => {
      toast.success("Payment updated");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      queryClient.invalidateQueries({ queryKey: ["dues-demands"] });
      queryClient.invalidateQueries({ queryKey: ["dues-demand-families"] });
      queryClient.invalidateQueries({ queryKey: ["dues-family"] });
      queryClient.invalidateQueries({ queryKey: ["member-payments"] });
      queryClient.invalidateQueries({ queryKey: ["family-payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const familyLabel = (familyId: string) => {
    const f = (families.data ?? []).find((x) => x.id === familyId);
    return f ? `${f.family_no} · ${f.family_name}` : "—";
  };

  return (
    <AppShell
      title="Payments"
      description={isAdmin ? "Review and approve family payments" : "Submit and track your payments"}
      actions={
        !isAdmin && myFamily.data ? <PaymentDialog familyId={myFamily.data.id} /> : undefined
      }
    >
      <div className="surface p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as StatusFilter);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isAdmin ? (
            <div className="min-w-[16rem] max-w-sm flex-1 space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Family</Label>
              <Select
                value={familyKey}
                onValueChange={(value) => {
                  setFamilyKey(value);
                  setPage(0);
                }}
              >
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
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Paid by</Label>
            <Select
              value={memberKey}
              onValueChange={(value) => {
                setMemberKey(value);
                setPage(0);
              }}
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
        </div>

        <div className="mt-5 space-y-3">
          {items.map((p) => (
            <article
              key={p.id}
              className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/vouchers/$id"
                    params={{ id: p.id }}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {p.voucher_no}
                  </Link>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.payment_date} · {p.mode === "cash" ? "Cash" : "Online transfer"}
                  {p.txn_ref ? ` · Ref ${p.txn_ref}` : ""}
                  {p.paid_by ? ` · Paid by ${p.paid_by}` : ""}
                </p>
                {isAdmin ? (
                  <p className="mt-1 text-xs text-muted-foreground">{familyLabel(p.family_id)}</p>
                ) : null}
                {p.remarks ? <p className="mt-1 text-xs">{p.remarks}</p> : null}
                {p.admin_remarks ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Admin note: {p.admin_remarks}
                  </p>
                ) : null}
                {p.screenshot_url ? (
                  <div className="mt-2">
                    <PrivateFileLink path={p.screenshot_url} label="View payment proof" />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-lg font-semibold">{formatMoney(p.amount)}</span>
                {isAdmin && p.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => decide.mutate({ id: p.id, next: "approved" })}
                      disabled={decide.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const remarks = window.prompt("Reason for rejection (optional)") ?? "";
                        decide.mutate({ id: p.id, next: "rejected", remarks });
                      }}
                      disabled={decide.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
                {p.status === "approved" ? (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/vouchers/$id" params={{ id: p.id }}>
                      View receipt
                    </Link>
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments to show.</p>
          ) : null}
        </div>
        {total > PAGE_SIZE ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {total} payments · page {page + 1} of {pageCount}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function PaymentDialog({ familyId }: { familyId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"cash" | "online">("online");
  const [dueId, setDueId] = useState("");
  const queryClient = useQueryClient();

  const dues = useQuery({
    queryKey: ["dues-family"],
    queryFn: () => listDemands(),
  });

  const payableDues = ((dues.data ?? []) as FamilyDueRow[]).filter(
    (d) => d.demand_status === "open" && d.payable > 0,
  );
  const selectedDue = payableDues.find((d) => d.id === dueId);

  const submit = useMutation({
    mutationFn: async (form: FormData) => {
      const amount = Number(form.get("amount"));
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount");
      if (selectedDue && amount > selectedDue.payable + 0.001) {
        throw new Error(`You can pay up to ${selectedDue.payable.toFixed(2)} on this due`);
      }
      const txnRef = String(form.get("txn_ref") ?? "").trim();
      const file = form.get("screenshot") as File | null;

      const paidByMemberId = String(form.get("paid_by_member_id") ?? "").trim();
      if (!paidByMemberId) throw new Error("Select which family member paid");

      if (mode === "online" && !txnRef) throw new Error("Transaction reference is required");
      if (mode === "online" && (!file || file.size === 0))
        throw new Error("Please attach the payment screenshot");

      let screenshotKey: string | null = null;
      if (file && file.size > 0) screenshotKey = await uploadFile(`${familyId}/payments`, file);

      await createPayment({
        data: {
          family_id: familyId,
          family_due_id: selectedDue?.id ?? null,
          amount,
          mode,
          payment_date: String(form.get("payment_date") ?? "") || todayLocalDate(),
          txn_ref: txnRef || null,
          paid_by: String(form.get("paid_by") ?? "").trim() || null,
          paid_by_member_id: paidByMemberId,
          remarks:
            String(form.get("remarks") ?? "").trim() ||
            (selectedDue ? `Payment for ${selectedDue.title}` : null),
          screenshot_url: screenshotKey,
        },
      });
    },
    onSuccess: () => {
      toast.success("Payment submitted for approval");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      queryClient.invalidateQueries({ queryKey: ["dues-family"] });
      queryClient.invalidateQueries({ queryKey: ["member-payments"] });
      queryClient.invalidateQueries({ queryKey: ["family-payments"] });
      setOpen(false);
      setDueId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDueId("");
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 size-4" /> Add payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate(new FormData(e.currentTarget));
          }}
        >
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Due</Label>
              <Select
                value={dueId || NONE_DUE}
                onValueChange={(value) => setDueId(value === NONE_DUE ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional — attach to a due" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_DUE}>General payment (no due)</SelectItem>
                  {payableDues.map((due) => (
                    <SelectItem key={due.id} value={due.id}>
                      {due.title} · {formatMoney(due.payable)} payable
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDue ? (
                <p className="text-xs text-muted-foreground">
                  Remaining {formatMoney(selectedDue.remaining)}
                  {selectedDue.paid_pending > 0
                    ? ` · ${formatMoney(selectedDue.paid_pending)} awaiting approval`
                    : ""}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {payableDues.length === 0
                    ? "No open due right now. You can still record a payment."
                    : "This payment will not be applied to a due."}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedDue?.payable}
                  key={selectedDue?.id ?? "amount"}
                  defaultValue={selectedDue?.payable ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_date">Payment date</Label>
                <Input
                  id="payment_date"
                  name="payment_date"
                  type="date"
                  defaultValue={todayLocalDate()}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paid_by">Paid by *</Label>
              <PaidBySelect familyId={familyId} id="paid_by" />
            </div>
            <div className="space-y-2">
              <Label>Payment mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "cash" | "online")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === "online" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="txn_ref">Transaction reference</Label>
                  <Input id="txn_ref" name="txn_ref" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="screenshot">Payment screenshot</Label>
                  <Input
                    id="screenshot"
                    name="screenshot"
                    type="file"
                    accept="image/*,.pdf"
                    required
                  />
                </div>
              </>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea id="remarks" name="remarks" rows={2} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? "Submitting…" : "Submit payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
