import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listFamilyMembers } from "@/lib/api/families";
import { relationshipLabel } from "@/lib/relationships";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Picks one of the family's members as the payer. Payments store the member id
 * and name so later history can be grouped member-wise.
 */
export function PaidBySelect({
  familyId,
  id,
  name = "paid_by",
  required = true,
}: {
  familyId: string;
  id?: string | undefined;
  name?: string | undefined;
  required?: boolean | undefined;
}) {
  const [selectedId, setSelectedId] = useState("");

  const members = useQuery({
    queryKey: ["family-members", familyId],
    enabled: !!familyId,
    queryFn: () => listFamilyMembers({ data: { familyId } }),
  });

  const list = members.data ?? [];
  const selected = list.find((m) => m.id === selectedId);

  const placeholder = members.isLoading
    ? "Loading family members…"
    : list.length === 0
      ? "No family members added yet"
      : "Select family member";

  return (
    <div className="space-y-1.5">
      <input type="hidden" name={name} value={selected?.full_name ?? ""} />
      <input
        id={id}
        name={`${name}_member_id`}
        value={selectedId}
        required={required}
        onChange={() => {}}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <Select value={selectedId} onValueChange={setSelectedId} disabled={list.length === 0}>
        <SelectTrigger id={id ? `${id}-trigger` : undefined} aria-required={required || undefined}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {list.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.full_name}
              <span className="text-muted-foreground"> · {relationshipLabel(member.relationship)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {required && !members.isLoading && list.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Add family members first. Paid by is required so payment history can be kept per person.
        </p>
      ) : null}
    </div>
  );
}
