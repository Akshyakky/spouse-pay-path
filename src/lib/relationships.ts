export const MEMBER_RELATIONSHIPS = [
  { value: "wife", label: "Wife" },
  { value: "husband", label: "Husband" },
  { value: "daughter", label: "Daughter" },
  { value: "son", label: "Son" },
  { value: "daughter_in_law", label: "Daughter-in-law" },
  { value: "son_in_law", label: "Son-in-law" },
  { value: "granddaughter", label: "Granddaughter" },
  { value: "grandson", label: "Grandson" },
  { value: "great_granddaughter", label: "Great-granddaughter" },
  { value: "great_grandson", label: "Great-grandson" },
  { value: "other", label: "Other dependent" },
] as const;

export type MemberRelationship = (typeof MEMBER_RELATIONSHIPS)[number]["value"];

export const MEMBER_RELATIONSHIP_VALUES = MEMBER_RELATIONSHIPS.map((r) => r.value) as [
  MemberRelationship,
  ...MemberRelationship[],
];

export function relationshipLabel(value: string | null | undefined): string {
  return MEMBER_RELATIONSHIPS.find((r) => r.value === value)?.label ?? value ?? "—";
}
