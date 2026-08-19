import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteFamilyMember,
  getFamilyById,
  listFamilyMembers,
  setFamilyHead,
  updateFamily,
  upsertFamilyMember,
  type MemberRow,
} from "@/lib/api/families";
import type { IdCardType } from "@/lib/api/mappers";
import { calcAge, uploadFile } from "@/lib/auth";
import {
  MEMBER_RELATIONSHIPS,
  relationshipLabel,
  type MemberRelationship,
} from "@/lib/relationships";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Member = MemberRow;

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const GENDERS = ["Male", "Female", "Other"] as const;

const ID_CARD_TYPES: { value: IdCardType; label: string }[] = [
  { value: "aadhaar", label: "Aadhaar" },
  { value: "pan", label: "PAN" },
  { value: "epic", label: "EPIC" },
  { value: "dl", label: "DL" },
  { value: "ration_card", label: "Ration Card" },
];

function idCardLabel(type: IdCardType | null | undefined) {
  return ID_CARD_TYPES.find((t) => t.value === type)?.label ?? type ?? "ID";
}

const profileSchema = z.object({
  family_no: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  family_name: z.string().trim().min(2, "Family name is required").max(120),
  address: z.string().trim().max(300).optional(),
  contact_phone: z.string().trim().max(30).optional(),
  contact_email: z.string().trim().max(255).optional(),
});

export function FamilyEditor({
  familyId,
  canEdit,
  canEditFamilyId = false,
}: {
  familyId: string;
  canEdit: boolean;
  canEditFamilyId?: boolean;
}) {
  const queryClient = useQueryClient();

  const familyQuery = useQuery({
    queryKey: ["family", familyId],
    queryFn: () => getFamilyById({ data: { id: familyId } }),
  });

  const membersQuery = useQuery({
    queryKey: ["family-members", familyId],
    queryFn: () => listFamilyMembers({ data: { familyId } }),
  });

  const saveProfile = useMutation({
    mutationFn: async (form: FormData) => {
      const parsed = profileSchema.parse({
        family_no: String(form.get("family_no") ?? ""),
        family_name: String(form.get("family_name") ?? ""),
        address: String(form.get("address") ?? ""),
        contact_phone: String(form.get("contact_phone") ?? ""),
        contact_email: String(form.get("contact_email") ?? ""),
      });
      const photo = form.get("family_photo") as File | null;
      let photoKey = familyQuery.data?.family_photo_url ?? null;
      if (photo && photo.size > 0) photoKey = await uploadFile(`${familyId}/family`, photo);

      await updateFamily({
        data: {
          id: familyId,
          family_no: canEditFamilyId
            ? parsed.family_no || familyQuery.data?.family_no
            : familyQuery.data?.family_no,
          family_name: parsed.family_name,
          address: parsed.address ?? null,
          contact_phone: parsed.contact_phone ?? null,
          contact_email: parsed.contact_email ?? null,
          family_photo_url: photoKey,
        },
      });
    },
    onSuccess: () => {
      toast.success("Family profile saved");
      queryClient.invalidateQueries({ queryKey: ["family", familyId] });
      queryClient.invalidateQueries({ queryKey: ["families"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      await deleteFamilyMember({ data: { id, familyId } });
    },
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["family-members", familyId] });
      queryClient.invalidateQueries({ queryKey: ["family", familyId] });
      queryClient.invalidateQueries({ queryKey: ["families"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setHead = useMutation({
    mutationFn: async (memberId: string) => {
      await setFamilyHead({ data: { memberId, familyId } });
    },
    onSuccess: () => {
      toast.success("Head of family updated");
      queryClient.invalidateQueries({ queryKey: ["family-members", familyId] });
      queryClient.invalidateQueries({ queryKey: ["family", familyId] });
      queryClient.invalidateQueries({ queryKey: ["families"] });
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
              {family?.head_of_family ? (
                <>
                  Head of family{" "}
                  <span className="font-medium text-foreground">{family.head_of_family}</span>
                  {" — change from members below"}
                </>
              ) : (
                "Set a head of family from members below"
              )}
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
            <Label htmlFor="family_no">Family ID</Label>
            <Input
              id="family_no"
              name="family_no"
              key={family?.family_no ?? "family-no"}
              defaultValue={family?.family_no ?? ""}
              disabled={!canEdit || !canEditFamilyId}
              required={canEditFamilyId}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="family_name">Family name</Label>
            <Input
              id="family_name"
              name="family_name"
              key={family?.family_name ?? "family-name"}
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
              Set one member as head of family. That name appears on the families list.
            </p>
          </div>
          {canEdit ? <MemberDialog familyId={familyId} /> : null}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {(membersQuery.data ?? []).map((member) => (
            <article key={member.id} className="flex gap-4 rounded-xl border border-border p-4">
              <PrivateImage path={member.photo_url} alt={member.full_name} className="size-16 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{member.full_name}</p>
                  <Badge variant="secondary">{relationshipLabel(member.relationship)}</Badge>
                  {member.is_head ? <Badge>Head of family</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[
                    member.gender,
                    member.id_card_type && member.id_card_number
                      ? `${idCardLabel(member.id_card_type)} ${member.id_card_number}`
                      : null,
                    member.blood_group ? `Blood ${member.blood_group}` : null,
                    member.date_of_birth
                      ? `${member.date_of_birth} (${calcAge(member.date_of_birth)} yrs)`
                      : null,
                    member.contact,
                    member.address,
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
                      {!member.is_head ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={setHead.isPending}
                          onClick={() => setHead.mutate(member.id)}
                        >
                          Set as head
                        </Button>
                      ) : null}
                      <MemberDialog familyId={familyId} member={member} />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={deleteMember.isPending}
                            aria-label={`Remove ${member.full_name}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {member.full_name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently deletes this family member. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => deleteMember.mutate(member.id)}
                            >
                              Remove member
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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

function ageToDob(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().slice(0, 10);
}

function MemberDialog({ familyId, member }: { familyId: string; member?: Member }) {
  const [open, setOpen] = useState(false);
  const [relationship, setRelationship] = useState<MemberRelationship>(member?.relationship ?? "wife");
  const [gender, setGender] = useState<string>(member?.gender ?? "");
  const [idCardType, setIdCardType] = useState<IdCardType | "">(member?.id_card_type ?? "");
  const [bloodGroup, setBloodGroup] = useState<string>(member?.blood_group ?? "");
  const [dob, setDob] = useState<string>(member?.date_of_birth ?? "");
  const [age, setAge] = useState<string>(
    member?.date_of_birth ? String(calcAge(member.date_of_birth) ?? "") : "",
  );
  const queryClient = useQueryClient();

  function resetFields() {
    setRelationship(member?.relationship ?? "wife");
    setGender(member?.gender ?? "");
    setIdCardType(member?.id_card_type ?? "");
    setBloodGroup(member?.blood_group ?? "");
    setDob(member?.date_of_birth ?? "");
    setAge(member?.date_of_birth ? String(calcAge(member.date_of_birth) ?? "") : "");
  }

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const fullName = String(form.get("full_name") ?? "").trim();
      if (fullName.length < 2) throw new Error("Full name is required");
      if (!gender) throw new Error("Gender is required");
      if (!idCardType) throw new Error("ID card type is required");
      const idCardNumber = String(form.get("id_card_number") ?? "").trim();
      if (idCardNumber.length < 3) throw new Error("ID card number is required");

      const photo = form.get("photo") as File | null;
      let photoKey = member?.photo_url ?? null;
      if (photo && photo.size > 0) photoKey = await uploadFile(`${familyId}/members`, photo);

      let dateOfBirth = dob || null;
      if (!dateOfBirth && age) {
        const n = Number(age);
        if (!Number.isInteger(n) || n < 0 || n > 120) throw new Error("Enter a valid age (0–120)");
        dateOfBirth = ageToDob(n);
      }

      await upsertFamilyMember({
        data: {
          id: member?.id,
          family_id: familyId,
          relationship,
          full_name: fullName,
          gender: gender as "Male" | "Female" | "Other",
          id_card_type: idCardType,
          id_card_number: idCardNumber,
          date_of_birth: dateOfBirth,
          blood_group: (bloodGroup || null) as
            | "A+"
            | "A-"
            | "B+"
            | "B-"
            | "AB+"
            | "AB-"
            | "O+"
            | "O-"
            | null,
          contact: String(form.get("contact") ?? "") || null,
          address: String(form.get("address") ?? "").trim() || null,
          remarks: String(form.get("remarks") ?? "") || null,
          photo_url: photoKey,
        },
      });
    },
    onSuccess: () => {
      toast.success(member ? "Member updated" : "Member added");
      queryClient.invalidateQueries({ queryKey: ["family-members", familyId] });
      queryClient.invalidateQueries({ queryKey: ["family", familyId] });
      queryClient.invalidateQueries({ queryKey: ["families"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) resetFields();
      }}
    >
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? "Update member" : "Add family member"}</DialogTitle>
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
            <Label>Relationship</Label>
            <Select value={relationship} onValueChange={(v) => setRelationship(v as MemberRelationship)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEMBER_RELATIONSHIPS.map((r) => (
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
              <Label>Gender</Label>
              <Select value={gender || undefined} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Blood group</Label>
              <Select
                value={bloodGroup || "none"}
                onValueChange={(v) => setBloodGroup(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {BLOOD_GROUPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>ID card type</Label>
              <Select
                value={idCardType || undefined}
                onValueChange={(v) => setIdCardType(v as IdCardType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ID type" />
                </SelectTrigger>
                <SelectContent>
                  {ID_CARD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="id_card_number">ID card number</Label>
              <Input
                id="id_card_number"
                name="id_card_number"
                defaultValue={member?.id_card_number ?? ""}
                required
                placeholder="Enter ID number"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of birth</Label>
              <Input
                id="date_of_birth"
                name="date_of_birth"
                type="date"
                value={dob}
                onChange={(e) => {
                  const value = e.target.value;
                  setDob(value);
                  const computed = calcAge(value);
                  setAge(computed == null ? "" : String(computed));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">Age (years)</Label>
              <Input
                id="age"
                name="age"
                type="number"
                min={0}
                max={120}
                placeholder="Or enter age"
                value={age}
                onChange={(e) => {
                  const value = e.target.value;
                  setAge(value);
                  const n = Number(value);
                  if (value !== "" && Number.isInteger(n) && n >= 0 && n <= 120) {
                    setDob(ageToDob(n));
                  }
                }}
              />
              <p className="text-[11px] text-muted-foreground">Enter DOB or age — either one works.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact">Contact details</Label>
            <Input id="contact" name="contact" defaultValue={member?.contact ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              name="address"
              rows={2}
              defaultValue={member?.address ?? ""}
              placeholder="Residential address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="photo">Photo</Label>
            <Input id="photo" name="photo" type="file" accept="image/*" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" name="remarks" rows={2} defaultValue={member?.remarks ?? ""} />
          </div>
          </DialogBody>
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
