import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createFamilyLogin } from "@/lib/admin.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/families/")({
  head: () => ({
    meta: [
      { title: "Families — Family Payment Tracking System" },
      { name: "description", content: "All registered families and their login accounts." },
      { property: "og:title", content: "Families — Family Payment Tracking System" },
      { property: "og:description", content: "Registered families and logins." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FamiliesPage,
});

function FamiliesPage() {
  const [search, setSearch] = useState("");

  const families = useQuery({
    queryKey: ["families"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("*")
        .order("family_no", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const term = search.trim().toLowerCase();
  const rows = (families.data ?? []).filter(
    (f) =>
      !term ||
      f.family_name.toLowerCase().includes(term) ||
      f.family_no.toLowerCase().includes(term) ||
      (f.contact_phone ?? "").toLowerCase().includes(term),
  );

  return (
    <AppShell
      title="Families"
      description="Create family logins and manage their records"
      actions={<CreateFamilyDialog />}
    >
      <div className="surface p-6">
        <Input
          placeholder="Search by family name, ID or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-3 pr-4">Family ID</th>
                <th className="pb-3 pr-4">Family name</th>
                <th className="pb-3 pr-4">Phone</th>
                <th className="pb-3 pr-4">Email</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((f) => (
                <tr key={f.id}>
                  <td className="py-3 pr-4 font-medium">{f.family_no}</td>
                  <td className="py-3 pr-4">{f.family_name}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{f.contact_phone ?? "—"}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{f.contact_email ?? "—"}</td>
                  <td className="py-3">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/families/$id" params={{ id: f.id }}>
                        Open
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-muted-foreground">
                    No families found.
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

function CreateFamilyDialog() {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const payload = {
        familyName: String(form.get("family_name") ?? "").trim(),
        username: String(form.get("username") ?? "").trim(),
        tempPassword: String(form.get("password") ?? ""),
        wifeName: String(form.get("wife_name") ?? "").trim(),
        contactPhone: String(form.get("contact_phone") ?? "").trim(),
        contactEmail: String(form.get("contact_email") ?? "").trim(),
      };
      await createFamilyLogin({ data: payload });
      return { username: payload.username, password: payload.tempPassword };
    },
    onSuccess: (result) => {
      setCreated(result);
      toast.success("Family login created");
      queryClient.invalidateQueries({ queryKey: ["families"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setCreated(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 size-4" /> New family
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create family login</DialogTitle>
        </DialogHeader>
        {created ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Share these credentials with the wife. She should change the password after first sign
              in.
            </p>
            <div className="rounded-lg border border-border bg-muted p-4">
              <p>
                Username: <span className="font-medium">{created.username}</span>
              </p>
              <p>
                Temporary password: <span className="font-medium">{created.password}</span>
              </p>
            </div>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate(new FormData(e.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="family_name">Family name</Label>
              <Input id="family_name" name="family_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wife_name">Wife's full name</Label>
              <Input id="wife_name" name="wife_name" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username">Login username</Label>
                <Input id="username" name="username" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Temporary password</Label>
                <Input id="password" name="password" minLength={8} required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact phone</Label>
                <Input id="contact_phone" name="contact_phone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact email</Label>
                <Input id="contact_email" name="contact_email" type="email" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create login"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
