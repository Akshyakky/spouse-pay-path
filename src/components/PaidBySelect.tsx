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
 * Picks one of the family's members as the payer. Payments store the payer's
 * name, so the selected member's name is submitted through a hidden input while
 * the dropdown itself tracks member ids (names can repeat within a family).
 */
export function PaidBySelect({
  familyId,
  id,
  name = "paid_by",
}: {
  familyId: string;
  id?: string | undefined;
  name?: string | undefined;
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
    <>
      <input type="hidden" name={name} value={selected?.full_name ?? ""} />
      <Select value={selectedId} onValueChange={setSelectedId} disabled={list.length === 0}>
        <SelectTrigger id={id}>
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
    </>
  );
}
