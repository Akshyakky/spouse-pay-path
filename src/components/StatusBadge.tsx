import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return <Badge className="bg-success text-success-foreground">Approved</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}
