import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  createFamilyWithLogin,
  deleteFamily,
  getNextFamilyNo,
  listFamilies,
  updateFamily,
} from "@/lib/api/families";
import { uploadFile } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PrivateImage } from "@/components/PrivateImage";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

type FamilyRow = {
  id: string;
  family_no: string;
  family_name: string;
  head_of_family: string | null;
  member_count: number;
  male_count: number;
  female_count: number;
  address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  family_photo_url: string | null;
};

function MemberCount({
  total,
  male,
  female,
}: {
  total: number;
  male: number;
  female: number;
}) {
  if (total === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const other = Math.max(0, total - male - female);

  return (
    <div
      className="inline-flex flex-col gap-0.5"
      title={`${total} members · ${male} male · ${female} female${other ? ` · ${other} other` : ""}`}
    >
      <span className="font-medium tabular-nums leading-none">{total}</span>
      <span className="flex items-center gap-1.5 text-[11px] leading-none text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-sky-700 dark:text-sky-300">
          <span className="font-medium tabular-nums">{male}</span>
          <span className="font-normal opacity-80">M</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-rose-700 dark:text-rose-300">
          <span className="font-medium tabular-nums">{female}</span>
          <span className="font-normal opacity-80">F</span>
        </span>
        {other > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
            <span className="font-medium tabular-nums">{other}</span>
            <span className="font-normal opacity-80">O</span>
          </span>
        ) : null}
      </span>
    </div>
  );
}

function FamiliesPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const families = useQuery({
    queryKey: ["families"],
    queryFn: () => listFamilies(),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => deleteFamily({ data: { id } }),
    onSuccess: (result) => {
      toast.success(`${result.family_name} deleted`);
      queryClient.invalidateQueries({ queryKey: ["families"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const term = search.trim().toLowerCase();
  const rows = (families.data ?? []).filter(
    (f) =>
      !term ||
      f.family_name.toLowerCase().includes(term) ||
      f.family_no.toLowerCase().includes(term) ||
      (f.head_of_family ?? "").toLowerCase().includes(term) ||
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
          placeholder="Search by family name, head, ID or phone"
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
                <th className="pb-3 pr-4">Head of family</th>
                <th className="pb-3 pr-4">Members</th>
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
                  <td className="py-3 pr-4">{f.head_of_family ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <MemberCount
                      total={f.member_count}
                      male={f.male_count}
                      female={f.female_count}
                    />
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{f.contact_phone ?? "—"}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{f.contact_email ?? "—"}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/families/$id" params={{ id: f.id }}>
                          Open
                        </Link>
                      </Button>
                      <EditFamilyDialog family={f} />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={remove.isPending}
                          >
                            <Trash2 className="mr-1.5 size-3.5" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {f.family_name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently removes the family record, members, and related
                              payments. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => remove.mutate(f.id)}
                            >
                              Delete family
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-muted-foreground">
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

function EditFamilyDialog({ family }: { family: FamilyRow }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const photo = form.get("family_photo") as File | null;
      let photoKey = family.family_photo_url;
      if (photo && photo.size > 0) photoKey = await uploadFile(`${family.id}/family`, photo);

      await updateFamily({
        data: {
          id: family.id,
          family_no: String(form.get("family_no") ?? "").trim() || family.family_no,
          family_name: String(form.get("family_name") ?? "").trim(),
          address: String(form.get("address") ?? "").trim() || null,
          contact_phone: String(form.get("contact_phone") ?? "").trim() || null,
          contact_email: String(form.get("contact_email") ?? "").trim() || null,
          family_photo_url: photoKey,
        },
      });
    },
    onSuccess: () => {
      toast.success("Family updated");
      queryClient.invalidateQueries({ queryKey: ["families"] });
      queryClient.invalidateQueries({ queryKey: ["family", family.id] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-1.5 size-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {family.family_no}</DialogTitle>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(new FormData(e.currentTarget));
          }}
        >
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`edit_family_no_${family.id}`}>Family ID</Label>
              <Input
                id={`edit_family_no_${family.id}`}
                name="family_no"
                defaultValue={family.family_no}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit_family_name_${family.id}`}>Family name</Label>
              <Input
                id={`edit_family_name_${family.id}`}
                name="family_name"
                defaultValue={family.family_name}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`edit_phone_${family.id}`}>Contact phone</Label>
                <Input
                  id={`edit_phone_${family.id}`}
                  name="contact_phone"
                  defaultValue={family.contact_phone ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`edit_email_${family.id}`}>Contact email</Label>
                <Input
                  id={`edit_email_${family.id}`}
                  name="contact_email"
                  type="email"
                  defaultValue={family.contact_email ?? ""}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit_address_${family.id}`}>Address</Label>
              <Textarea
                id={`edit_address_${family.id}`}
                name="address"
                rows={2}
                defaultValue={family.address ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit_photo_${family.id}`}>Family photo</Label>
              <div className="flex items-center gap-3">
                <PrivateImage
                  path={family.family_photo_url}
                  alt="Family photo"
                  className="size-14 shrink-0"
                />
                <Input
                  id={`edit_photo_${family.id}`}
                  name="family_photo"
                  type="file"
                  accept="image/*"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateFamilyDialog() {
  const [open, setOpen] = useState(false);
  const [familyNo, setFamilyNo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [created, setCreated] = useState<{
    familyNo: string;
    username: string;
    password: string;
  } | null>(null);
  const queryClient = useQueryClient();

  const fillNextId = async () => {
    setGenerating(true);
    try {
      const result = await getNextFamilyNo();
      setFamilyNo(result.familyNo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate Family ID");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (open && !created) {
      void fillNextId();
    }
  }, [open, created]);

  const resetForm = () => {
    setCreated(null);
    setFamilyNo("");
  };

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const result = await createFamilyWithLogin({
        data: {
          family_no: familyNo.trim(),
          family_name: String(form.get("family_name") ?? "").trim(),
          username: String(form.get("username") ?? "").trim(),
          password: String(form.get("password") ?? ""),
          address: String(form.get("address") ?? "").trim() || null,
          contact_phone: String(form.get("contact_phone") ?? "").trim() || null,
          contact_email: String(form.get("contact_email") ?? "").trim() || null,
          family_photo_url: null,
        },
      });

      const photo = form.get("family_photo") as File | null;
      if (photo && photo.size > 0) {
        const photoKey = await uploadFile(`${result.familyId}/family`, photo);
        await updateFamily({
          data: {
            id: result.familyId,
            family_no: result.familyNo,
            family_name: String(form.get("family_name") ?? "").trim(),
            address: String(form.get("address") ?? "").trim() || null,
            contact_phone: String(form.get("contact_phone") ?? "").trim() || null,
            contact_email: String(form.get("contact_email") ?? "").trim() || null,
            family_photo_url: photoKey,
          },
        });
      }

      return result;
    },
    onSuccess: (result) => {
      setCreated({
        familyNo: result.familyNo,
        username: result.username,
        password: result.password,
      });
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
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 size-4" /> New family
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create family login</DialogTitle>
        </DialogHeader>
        {created ? (
          <DialogBody className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Share these credentials for the family login. They should change the password after
              first sign in.
            </p>
            <div className="rounded-lg border border-border bg-muted p-4">
              <p>
                Family ID: <span className="font-medium">{created.familyNo}</span>
              </p>
              <p>
                Username: <span className="font-medium">{created.username}</span>
              </p>
              <p>
                Temporary password: <span className="font-medium">{created.password}</span>
              </p>
            </div>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </DialogBody>
        ) : (
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate(new FormData(e.currentTarget));
            }}
          >
            <DialogBody className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="family_no">Family ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="family_no"
                    name="family_no"
                    value={familyNo}
                    onChange={(e) => setFamilyNo(e.target.value.toUpperCase())}
                    placeholder="e.g. FAM-0003"
                    required
                    disabled={generating && !familyNo}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void fillNextId()}
                    disabled={generating}
                    title="Generate next Family ID"
                  >
                    <RefreshCw className={`mr-1.5 size-3.5 ${generating ? "animate-spin" : ""}`} />
                    Generate
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="family_name">Family name</Label>
                <Input id="family_name" name="family_name" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" name="address" rows={2} placeholder="Family residential address" />
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

              <div className="space-y-2">
                <Label htmlFor="family_photo">Family photo</Label>
                <Input id="family_photo" name="family_photo" type="file" accept="image/*" />
              </div>
            </DialogBody>
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
