import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { FamilyEditor } from "@/components/family/FamilyEditor";
import { useMyFamily } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/family")({
  head: () => ({
    meta: [
      { title: "My family — Family Payment Tracking System" },
      { name: "description", content: "Maintain your family profile and member details." },
      { property: "og:title", content: "My family — Family Payment Tracking System" },
      { property: "og:description", content: "Family profile and member details." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyFamilyPage,
});

function MyFamilyPage() {
  const { data: family, isLoading } = useMyFamily();

  return (
    <AppShell
      title="My family"
      description={family ? `${family.family_no} · ${family.family_name}` : "Family details"}
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading family record…</p>
      ) : family ? (
        <FamilyEditor familyId={family.id} canEdit />
      ) : (
        <div className="surface p-6 text-sm text-muted-foreground">
          No family record is linked to your login yet. Please contact the administrator.
        </div>
      )}
    </AppShell>
  );
}
