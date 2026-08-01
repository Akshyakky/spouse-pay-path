import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resetFamilyPassword } from "@/lib/admin.functions";
import { AppShell } from "@/components/AppShell";
import { FamilyEditor } from "@/components/family/FamilyEditor";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMoney } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/families/$id")({
  head: () => ({
    meta: [
      { title: "Family record — Family Payment Tracking System" },
      { name: "description", content: "Family profile, members, payments and login controls." },
      { property: "og:title", content: "Family record — Family Payment Tracking System" },
      { property: "og:description", content: "Family profile, members and payments." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FamilyDetail,
});

function FamilyDetail() {
  const { id } = Route.useParams();

  const family = useQuery({
    queryKey: ["family", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("families").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const payments = useQuery({
    queryKey: ["family-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, voucher_no, amount, status, payment_date, mode")
        .eq("family_id", id)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <AppShell
      title={family.data ? family.data.family_name : "Family record"}
      description={family.data ? `Family ID ${family.data.family_no}` : undefined}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/families">Back to list</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <FamilyEditor familyId={id} canEdit />

        <section className="surface p-6">
          <h2 className="text-base font-semibold">Login access</h2>
          {family.data?.wife_user_id ? (
            <ResetPasswordForm userId={family.data.wife_user_id} />
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No login is linked to this family yet.
            </p>
          )}
        </section>

        <section className="surface p-6">
          <h2 className="text-base font-semibold">Payment history</h2>
          <div className="mt-4 divide-y divide-border">
            {(payments.data ?? []).map((p) => (
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
            {(payments.data ?? []).length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No payments yet.</p>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ResetPasswordForm({ userId }: { userId: string }) {
  const [password, setPassword] = useState("");

  const reset = useMutation({
    mutationFn: async () => {
      await resetFamilyPassword({ data: { userId, password } });
    },
    onSuccess: () => {
      toast.success("Password reset. Share it with the family.");
      setPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        reset.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="new_password">New temporary password</Label>
        <Input
          id="new_password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
          className="w-64"
        />
      </div>
      <Button type="submit" variant="outline" disabled={reset.isPending}>
        {reset.isPending ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}
