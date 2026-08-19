import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  createDemand,
  listDemandFamilies,
  listDemands,
  setDemandStatus,
  type FamilyDueRow,
} from "@/lib/api/dues";
import { createPayment } from "@/lib/api/payments";
import { AppShell } from "@/components/AppShell";
import { formatMoney, uploadFile, useMyFamily, useRole } from "@/lib/auth";
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

export const Route = createFileRoute("/_authenticated/dues")({
  head: () => ({
    meta: [
      { title: "Dues — Family Payment Tracking System" },
      { name: "description", content: "Raise contribution demands and track family dues." },
      { property: "og:title", content: "Dues — Family Payment Tracking System" },
      { property: "og:description", content: "Contribution demands and outstanding dues." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DuesPage,
});

function DuesPage() {
  const { isAdmin } = useRole();
  return isAdmin ? <AdminDuesPage /> : <FamilyDuesPage />;
}

function AdminDuesPage() {
  const queryClient = useQueryClient();
  const [selectedDemandId, setSelectedDemandId] = useState<string | null>(null);

  const demands = useQuery({
    queryKey: ["dues-demands"],
    queryFn: () => listDemands(),
  });

  const families = useQuery({
    queryKey: ["dues-demand-families", selectedDemandId],
    enabled: !!selectedDemandId,
    queryFn: () => listDemandFamilies({ data: { demandId: selectedDemandId! } }),
  });

  const closeDemand = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "open" | "closed" }) =>
      setDemandStatus({ data: { id, status } }),
    onSuccess: () => {
      toast.success("Demand updated");
      queryClient.invalidateQueries({ queryKey: ["dues-demands"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adminDemands = (demands.data ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    amount_per_family: number;
    due_date: string | null;
    status: "open" | "closed";
    family_count: number;
    collected: number;
    total_due: number;
    outstanding: number;
  }>;

  return (
    <AppShell
      title="Dues"
      description="Raise a contribution demand for every family (e.g. yearly expense, construction)"
      actions={<CreateDemandDialog />}
    >
      <div className="space-y-6">
        <section className="surface p-6">
          <h2 className="text-base font-semibold">Contribution demands</h2>
          <div className="mt-4 space-y-3">
            {adminDemands.map((d) => (
              <article
                key={d.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{d.title}</p>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        d.status === "open"
                          ? "bg-emerald-500/10 text-emerald-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {d.status === "open" ? "Open" : "Closed"}
                    </span>
                  </div>
                  {d.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{d.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatMoney(d.amount_per_family)} per family · {d.family_count} families
                    {d.due_date ? ` · Due ${d.due_date}` : ""}
                  </p>
                  <p className="mt-2 text-sm">
                    Collected {formatMoney(d.collected)} · Outstanding{" "}
                    <span className="font-medium">{formatMoney(d.outstanding)}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedDemandId(d.id === selectedDemandId ? null : d.id)}
                  >
                    {d.id === selectedDemandId ? "Hide families" : "View families"}
                  </Button>
                  {d.status === "open" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={closeDemand.isPending}
                      onClick={() => closeDemand.mutate({ id: d.id, status: "closed" })}
                    >
                      Close
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={closeDemand.isPending}
                      onClick={() => closeDemand.mutate({ id: d.id, status: "open" })}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </article>
            ))}
            {adminDemands.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No demands yet. Create one to ask every family for a contribution.
              </p>
            ) : null}
          </div>
        </section>

        {selectedDemandId ? (
          <section className="surface p-6">
            <h2 className="text-base font-semibold">Family-wise dues</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-3 pr-4">Family</th>
                    <th className="pb-3 pr-4">Due</th>
                    <th className="pb-3 pr-4">Paid</th>
                    <th className="pb-3 pr-4">Pending</th>
                    <th className="pb-3">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(families.data ?? []).map((f) => (
                    <tr key={f.id}>
                      <td className="py-3 pr-4">
                        <span className="font-medium">{f.family_no}</span>
                        <span className="text-muted-foreground"> · {f.family_name}</span>
                      </td>
                      <td className="py-3 pr-4 tabular-nums">{formatMoney(f.amount_due)}</td>
                      <td className="py-3 pr-4 tabular-nums text-emerald-700">
                        {formatMoney(f.paid_approved)}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                        {formatMoney(f.paid_pending)}
                      </td>
                      <td className="py-3 font-medium tabular-nums">{formatMoney(f.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function FamilyDuesPage() {
  const myFamily = useMyFamily();
  const dues = useQuery({
    queryKey: ["dues-family"],
    queryFn: () => listDemands(),
  });

  const rows = (dues.data ?? []) as FamilyDueRow[];
  const openRows = rows.filter((d) => d.demand_status === "open");
  const closedRows = rows.filter((d) => d.demand_status === "closed");
  const totalRemaining = openRows.reduce((sum, d) => sum + d.remaining, 0);

  return (
    <AppShell
      title="My dues"
      description={
        myFamily.data
          ? `${myFamily.data.family_no} · Outstanding ${formatMoney(totalRemaining)}`
          : "Your contribution demands and remaining balance"
      }
    >
      <div className="surface p-6">
        <div className="space-y-3">
          {openRows.map((due) => (
            <DueCard key={due.id} due={due} familyId={myFamily.data?.id} />
          ))}
          {openRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open dues right now.</p>
          ) : null}
        </div>

        {closedRows.length > 0 ? (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-muted-foreground">Closed</h2>
            <div className="mt-3 space-y-3">
              {closedRows.map((due) => (
                <DueCard key={due.id} due={due} familyId={myFamily.data?.id} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function DueCard({ due, familyId }: { due: FamilyDueRow; familyId?: string }) {
  const settled = due.remaining <= 0;
  return (
    <article className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{due.title}</p>
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
              settled
                ? "bg-emerald-500/10 text-emerald-700"
                : "bg-amber-500/10 text-amber-800"
            }`}
          >
            {settled ? "Paid" : "Due"}
          </span>
        </div>
        {due.description ? (
          <p className="mt-1 text-xs text-muted-foreground">{due.description}</p>
        ) : null}
        <p className="mt-2 text-sm">
          Total {formatMoney(due.amount_due)} · Paid {formatMoney(due.paid_approved)}
          {due.paid_pending > 0 ? ` · Pending ${formatMoney(due.paid_pending)}` : ""}
        </p>
        <p className="mt-1 text-sm">
          Remaining{" "}
          <span className="font-semibold tabular-nums">{formatMoney(due.remaining)}</span>
          {due.due_date ? (
            <span className="text-muted-foreground"> · Due by {due.due_date}</span>
          ) : null}
        </p>
      </div>
      {familyId && due.demand_status === "open" && due.payable > 0 ? (
        <PayDueDialog familyId={familyId} due={due} />
      ) : null}
    </article>
  );
}

function CreateDemandDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const amount = Number(form.get("amount"));
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount");
      return createDemand({
        data: {
          title: String(form.get("title") ?? "").trim(),
          description: String(form.get("description") ?? "").trim() || null,
          amount_per_family: amount,
          due_date: String(form.get("due_date") ?? "").trim() || null,
        },
      });
    },
    onSuccess: (result) => {
      toast.success(`Demand created for ${result.familyCount} families`);
      queryClient.invalidateQueries({ queryKey: ["dues-demands"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 size-4" /> New demand
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise contribution demand</DialogTitle>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(new FormData(e.currentTarget));
          }}
        >
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                required
                placeholder="e.g. Yearly expense 2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount per family</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min={1}
                step="0.01"
                required
                placeholder="e.g. 3000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due date (optional)</Label>
              <Input id="due_date" name="due_date" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                placeholder="What this contribution is for"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Creates an open due for every registered family at the same amount. Families can pay
              in full or in parts until the remaining balance is cleared.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create demand"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PayDueDialog({ familyId, due }: { familyId: string; due: FamilyDueRow }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"cash" | "online">("online");
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: async (form: FormData) => {
      const amount = Number(form.get("amount"));
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount");
      if (amount > due.payable + 0.001) {
        throw new Error(`You can pay up to ${due.payable.toFixed(2)} right now`);
      }
      const txnRef = String(form.get("txn_ref") ?? "").trim();
      const file = form.get("screenshot") as File | null;
      if (mode === "online" && !txnRef) throw new Error("Transaction reference is required");
      if (mode === "online" && (!file || file.size === 0)) {
        throw new Error("Please attach the payment screenshot");
      }
      let screenshotKey: string | null = null;
      if (file && file.size > 0) screenshotKey = await uploadFile(`${familyId}/payments`, file);

      await createPayment({
        data: {
          family_id: familyId,
          family_due_id: due.id,
          amount,
          mode,
          payment_date:
            String(form.get("payment_date") ?? "") || new Date().toISOString().slice(0, 10),
          txn_ref: txnRef || null,
          paid_by: String(form.get("paid_by") ?? "").trim() || null,
          remarks: String(form.get("remarks") ?? "").trim() || `Payment for ${due.title}`,
          screenshot_url: screenshotKey,
        },
      });
    },
    onSuccess: () => {
      toast.success("Payment submitted for approval");
      queryClient.invalidateQueries({ queryKey: ["dues-family"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Pay</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay toward {due.title}</DialogTitle>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate(new FormData(e.currentTarget));
          }}
        >
          <DialogBody className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Remaining {formatMoney(due.remaining)}
              {due.paid_pending > 0
                ? ` · ${formatMoney(due.paid_pending)} awaiting approval`
                : ""}
              . You can pay up to {formatMoney(due.payable)} now.
            </p>
            <div className="space-y-2">
              <Label htmlFor={`amount_${due.id}`}>Amount</Label>
              <Input
                id={`amount_${due.id}`}
                name="amount"
                type="number"
                min={1}
                max={due.payable}
                step="0.01"
                defaultValue={due.payable}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
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
            <div className="space-y-2">
              <Label htmlFor={`payment_date_${due.id}`}>Payment date</Label>
              <Input
                id={`payment_date_${due.id}`}
                name="payment_date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            {mode === "online" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`txn_ref_${due.id}`}>Transaction reference</Label>
                  <Input id={`txn_ref_${due.id}`} name="txn_ref" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`screenshot_${due.id}`}>Screenshot</Label>
                  <Input
                    id={`screenshot_${due.id}`}
                    name="screenshot"
                    type="file"
                    accept="image/*"
                    required
                  />
                </div>
              </>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`paid_by_${due.id}`}>Paid by</Label>
              <Input id={`paid_by_${due.id}`} name="paid_by" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`remarks_${due.id}`}>Remarks</Label>
              <Textarea id={`remarks_${due.id}`} name="remarks" rows={2} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? "Submitting…" : "Submit payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
