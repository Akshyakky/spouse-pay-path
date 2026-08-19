import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createExpense, listExpenses } from "@/lib/api/expenses";
import { AppShell } from "@/components/AppShell";
import { formatMoney, uploadFile, useRole } from "@/lib/auth";
import { PrivateFileLink } from "@/components/PrivateImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — Family Payment Tracking System" },
      { name: "description", content: "Record and review debit entries and expense receipts." },
      { property: "og:title", content: "Expenses — Family Payment Tracking System" },
      { property: "og:description", content: "Debit entries and expense receipts." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const { isAdmin } = useRole();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const expenses = useQuery({
    queryKey: ["expenses"],
    enabled: isAdmin,
    queryFn: () => listExpenses(),
  });

  const add = useMutation({
    mutationFn: async (form: FormData) => {
      setSaving(true);
      const amount = Number(form.get("amount"));
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount");
      const file = form.get("attachment") as File | null;
      let key: string | null = null;
      if (file && file.size > 0) key = await uploadFile("expenses", file);
      await createExpense({
        data: {
          amount,
          category: String(form.get("category") ?? "").trim() || "General",
          description: String(form.get("description") ?? "").trim() || null,
          expense_date:
            String(form.get("expense_date") ?? "") || new Date().toISOString().slice(0, 10),
          attachment_url: key,
        },
      });
    },
    onSuccess: () => {
      toast.success("Expense recorded");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setSaving(false),
  });

  const total = (expenses.data ?? []).reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <AppShell title="Expenses" description="Debit entries maintained by administrators">
      {!isAdmin ? (
        <div className="surface p-6 text-sm text-muted-foreground">
          Expenses are visible to administrators only.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="surface p-6">
            <h2 className="text-base font-semibold">Record expense</h2>
            <form
              className="mt-4 grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                const form = e.currentTarget;
                e.preventDefault();
                add.mutate(new FormData(form), { onSuccess: () => form.reset() });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense_date">Date</Label>
                <Input
                  id="expense_date"
                  name="expense_date"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" placeholder="Utilities, groceries…" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attachment">Receipt</Label>
                <Input id="attachment" name="attachment" type="file" accept="image/*,.pdf" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={2} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Add expense"}
                </Button>
              </div>
            </form>
          </section>

          <section className="surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Expense history</h2>
              <p className="text-sm text-muted-foreground">
                Total debit: <span className="font-semibold text-destructive">{formatMoney(total)}</span>
              </p>
            </div>
            <div className="mt-4 divide-y divide-border">
              {(expenses.data ?? []).map((e) => (
                <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{e.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.expense_date}
                      {e.description ? ` · ${e.description}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Added by {e.created_by_name ?? "Unknown"}
                    </p>
                    {e.attachment_url ? (
                      <PrivateFileLink path={e.attachment_url} label="View receipt" />
                    ) : null}
                  </div>
                  <span className="font-medium text-destructive">{formatMoney(e.amount)}</span>
                </div>
              ))}
              {(expenses.data ?? []).length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">No expenses recorded yet.</p>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
