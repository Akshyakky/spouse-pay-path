import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calcAge, uploadFile } from "@/lib/auth";
import { PrivateImage } from "@/components/PrivateImage";
import { MemberIdCard } from "@/components/family/MemberIdCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
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

type Relationship = "wife" | "husband" | "daughter" | "son" | "other";

type Member = {
  id: string;
  family_id: string;
  relationship: Relationship;
  full_name: string;
  gender: string | null;
  date_of_birth: string | null;
  contact: string | null;
  photo_url: string | null;
  remarks: string | null;
};

const RELATIONSHIPS: { value: Relationship; label: string }[] = [
  { value: "wife", label: "Wife" },
  { value: "husband", label: "Husband" },
  { value: "daughter", label: "Daughter" },
  { value: "son", label: "Son" },
  { value: "other", label: "Other dependent" },
];

const profileSchema = z.object({
  family_name: z.string().trim().min(2, "Family name is required").max(120),
  address: z.string().trim().max(300).optional(),
  contact_phone: z.string().trim().max(30).optional(),
  contact_email: z.string().trim().max(255).optional(),
});

export function FamilyEditor({ familyId, canEdit }: { familyId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();

  const familyQuery = useQuery({
    queryKey: ["family", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("*")
        .eq("id", familyId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const membersQuery = useQuery({
    queryKey: ["family-members", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("*")
        .eq("family_id", familyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const saveProfile = useMutation({
    mutationFn: async (form: FormData) => {
      const parsed = profileSchema.parse({
        family_name: String(form.get("family_name") ?? ""),
        address: String(form.get("address") ?? ""),
        contact_phone: String(form.get("contact_phone") ?? ""),
        contact_email: String(form.get("contact_email") ?? ""),
      });
      const photo = form.get("family_photo") as File | null;
      let photoKey = familyQuery.data?.family_photo_url ?? null;
      if (photo && photo.size > 0) photoKey = await uploadFile(`${familyId}/family`, photo);

      const { error } = await supabase
        .from("families")
        .update({
          family_name: parsed.family_name,
          address: parsed.address ?? null,
          contact_phone: parsed.contact_phone ?? null,
          contact_email: parsed.contact_email ?? null,
          family_photo_url: photoKey,
        })
        .eq("id", familyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Family profile saved");
      queryClient.invalidateQueries({ queryKey: ["family", familyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("family_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["family-members", familyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const family = familyQuery.data;

  return (
    <div className="space-y-6">
      <section className="surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Family profile</h2>
            <p className="text-sm text-muted-foreground">
              Family ID <span className="font-medium text-foreground">{family?.family_no}</span>
            </p>
          </div>
          <PrivateImage
            path={family?.family_photo_url}
            alt="Family photo"
            className="size-20 shrink-0"
          />
        </div>

        <form
          className="mt-6 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveProfile.mutate(new FormData(e.currentTarget));
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="family_name">Family name</Label>
            <Input
              id="family_name"
              name="family_name"
              defaultValue={family?.family_name ?? ""}
              disabled={!canEdit}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_phone">Contact phone</Label>
            <Input
              id="contact_phone"
              name="contact_phone"
              defaultValue={family?.contact_phone ?? ""}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email">Contact email</Label>
            <Input
              id="contact_email"
              name="contact_email"
              defaultValue={family?.contact_email ?? ""}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="family_photo">Family photo</Label>
            <Input id="family_photo" name="family_photo" type="file" accept="image/*" disabled={!canEdit} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              name="address"
              rows={2}
              defaultValue={family?.address ?? ""}
              disabled={!canEdit}
            />
          </div>
          {canEdit ? (
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saveProfile.isPending}>
                {saveProfile.isPending ? "Saving…" : "Save profile"}
              </Button>
            </div>
          ) : null}
        </form>
      </section>

      <section className="surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Family members</h2>
            <p className="text-sm text-muted-foreground">
              Husband, daughter, son and any other dependents.
            </p>
          </div>
          {canEdit ? <MemberDialog familyId={familyId} /> : null}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {(membersQuery.data ?? []).map((member) => (
            <article key={member.id} className="flex gap-4 rounded-xl border border-border p-4">
              <PrivateImage path={member.photo_url} alt={member.full_name} className="size-16 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{member.full_name}</p>
                  <Badge variant="secondary" className="capitalize">
                    {member.relationship}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[
                    member.gender,
                    member.date_of_birth
                      ? `${member.date_of_birth} (${calcAge(member.date_of_birth)} yrs)`
                      : null,
                    member.contact,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No details yet"}
                </p>
                {member.remarks ? (
                  <p className="mt-1 text-xs text-muted-foreground">{member.remarks}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <MemberIdCard
                    member={member}
                    familyNo={family?.family_no ?? "—"}
                    familyName={family?.family_name ?? "—"}
                  />
                  {canEdit ? (
                    <>
                      <MemberDialog familyId={familyId} member={member} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMember.mutate(member.id)}
                        aria-label={`Remove ${member.full_name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
          {(membersQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No family members added yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MemberDialog({ familyId, member }: { familyId: string; member?: Member }) {
  const [open, setOpen] = useState(false);
  const [relationship, setRelationship] = useState<Relationship>(member?.relationship ?? "husband");
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const fullName = String(form.get("full_name") ?? "").trim();
      if (fullName.length < 2) throw new Error("Full name is required");
      const photo = form.get("photo") as File | null;
      let photoKey = member?.photo_url ?? null;
      if (photo && photo.size > 0) photoKey = await uploadFile(`${familyId}/members`, photo);

      const payload = {
        family_id: familyId,
        relationship,
        full_name: fullName,
        gender: String(form.get("gender") ?? "") || null,
        date_of_birth: String(form.get("date_of_birth") ?? "") || null,
        contact: String(form.get("contact") ?? "") || null,
        remarks: String(form.get("remarks") ?? "") || null,
        photo_url: photoKey,
      };

      if (member) {
        const { error } = await supabase.from("family_members").update(payload).eq("id", member.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("family_members").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(member ? "Member updated" : "Member added");
      queryClient.invalidateQueries({ queryKey: ["family-members", familyId] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {member ? (
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 size-3.5" /> Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-2 size-4" /> Add member
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{member ? "Update member" : "Add family member"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(new FormData(e.currentTarget));
          }}
        >
          <div className="space-y-2">
            <Label>Relationship</Label>
            <Select value={relationship} onValueChange={(v) => setRelationship(v as Relationship)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" defaultValue={member?.full_name ?? ""} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Input id="gender" name="gender" defaultValue={member?.gender ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of birth</Label>
              <Input
                id="date_of_birth"
                name="date_of_birth"
                type="date"
                defaultValue={member?.date_of_birth ?? ""}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact">Contact details</Label>
            <Input id="contact" name="contact" defaultValue={member?.contact ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="photo">Photo</Label>
            <Input id="photo" name="photo" type="file" accept="image/*" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" name="remarks" rows={2} defaultValue={member?.remarks ?? ""} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
