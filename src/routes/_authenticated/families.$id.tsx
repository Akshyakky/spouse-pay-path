import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getFamilyById } from "@/lib/api/families";
import { listPayments } from "@/lib/api/payments";
import { resetFamilyPassword, setFamilyLoginActive } from "@/lib/admin.functions";
import { AppShell } from "@/components/AppShell";
import { FamilyEditor } from "@/components/family/FamilyEditor";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMoney } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { orgPageTitle } from "@/lib/org";

export const Route = createFileRoute("/_authenticated/families/$id")({
  head: () => ({
    meta: [
      { title: orgPageTitle("Family record") },
      { name: "description", content: "Family profile, members, payments and login controls." },
      { property: "og:title", content: orgPageTitle("Family record") },
      { property: "og:description", content: "Family profile, members and payments." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FamilyDetail,
});

const PAGE_SIZE = 50;

function FamilyDetail() {
  const { id } = Route.useParams();
  const [page, setPage] = useState(0);

  const family = useQuery({
    queryKey: ["family", id],
    queryFn: () => getFamilyById({ data: { id } }),
  });

  const payments = useQuery({
    queryKey: ["family-payments", id, page],
    queryFn: () =>
      listPayments({ data: { familyId: id, limit: PAGE_SIZE, offset: page * PAGE_SIZE } }),
  });

  const items = payments.data?.items ?? [];
  const total = payments.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setPage(0);
  }, [id]);

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

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
        <FamilyEditor familyId={id} canEdit canEditFamilyId />

        <section className="surface p-6">
          <h2 className="text-base font-semibold">Login access</h2>
          {family.data?.wife_user_id ? (
            <LoginAccess
              familyId={id}
              loginActive={family.data.login_active !== false}
            />
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No login is linked to this family yet.
            </p>
          )}
        </section>

        <section className="surface p-6">
          <h2 className="text-base font-semibold">Payment history</h2>
          <div className="mt-4 divide-y divide-border">
            {items.map((p) => (
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
            {items.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No payments yet.</p>
            ) : null}
          </div>
          {total > PAGE_SIZE ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
        </section>
      </div>
    </AppShell>
  );
}

function LoginAccess({ familyId, loginActive }: { familyId: string; loginActive: boolean }) {
  const queryClient = useQueryClient();

  const lock = useMutation({
    mutationFn: async (active: boolean) => setFamilyLoginActive({ data: { familyId, active } }),
    onSuccess: (result) => {
      toast.success(result.active ? "Login unlocked" : "Login locked");
      queryClient.invalidateQueries({ queryKey: ["family", familyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {loginActive
            ? "This family can sign in with the issued username."
            : "This login is locked. They cannot sign in until you unlock it."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={lock.isPending}
          onClick={() => lock.mutate(!loginActive)}
        >
          {lock.isPending ? "Updating…" : loginActive ? "Lock login" : "Unlock login"}
        </Button>
      </div>
      <ResetPasswordForm familyId={familyId} />
    </div>
  );
}

function ResetPasswordForm({ familyId }: { familyId: string }) {
  const [password, setPassword] = useState("");

  const reset = useMutation({
    mutationFn: async () => {
      await resetFamilyPassword({ data: { familyId, password } });
    },
    onSuccess: () => {
      toast.success("Password reset. Existing sessions were signed out.");
      setPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="flex flex-wrap items-end gap-3"
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
