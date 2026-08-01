import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createAdminLogin, listAdmins } from "@/lib/admin.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admins")({
  head: () => ({
    meta: [
      { title: "Administrators — Family Payment Tracking System" },
      { name: "description", content: "Manage administrator accounts for the tracking system." },
      { property: "og:title", content: "Administrators — Family Payment Tracking System" },
      { property: "og:description", content: "Manage administrator accounts." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminsPage,
});

function AdminsPage() {
  const queryClient = useQueryClient();

  const admins = useQuery({
    queryKey: ["admins"],
    queryFn: () => listAdmins(),
  });

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      await createAdminLogin({
        data: {
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
          fullName: String(form.get("full_name") ?? "").trim(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Administrator created");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Administrators" description="Multiple administrators are supported">
      <div className="space-y-6">
        <section className="surface p-6">
          <h2 className="text-base font-semibold">Add administrator</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-3"
            onSubmit={(e) => {
              const form = e.currentTarget;
              e.preventDefault();
              create.mutate(new FormData(form), { onSuccess: () => form.reset() });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Temporary password</Label>
              <Input id="password" name="password" minLength={8} required />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create administrator"}
              </Button>
            </div>
          </form>
        </section>

        <section className="surface p-6">
          <h2 className="text-base font-semibold">Current administrators</h2>
          <div className="mt-4 divide-y divide-border">
            {(admins.data ?? []).map((a) => (
              <div key={a.user_id} className="py-3 text-sm">
                <p className="font-medium">{a.profile?.full_name || a.profile?.username || a.user_id}</p>
                <p className="text-xs text-muted-foreground">
                  Added {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
            {(admins.data ?? []).length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No administrators listed.</p>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
