import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getFamilyById } from "@/lib/api/families";
import { AppShell } from "@/components/AppShell";
import { FamilyEditor } from "@/components/family/FamilyEditor";
import { FamilyLoginPanel } from "@/components/family/FamilyLoginPanel";
import { MemberPaymentsPanel } from "@/components/family/MemberPaymentsPanel";
import { useRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { orgPageTitle } from "@/lib/org";

export const Route = createFileRoute("/_authenticated/families/$id")({
  head: () => ({
    meta: [
      { title: orgPageTitle("Family record") },
      { name: "description", content: "Family profile, members, payments and login controls." },
      { property: "og:title", content: orgPageTitle("Family record") },
      { property: "og:description", content: "Family profile, members and payments." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FamilyDetail,
});

function FamilyDetail() {
  const { id } = Route.useParams();
  const { isAdmin } = useRole();

  const family = useQuery({
    queryKey: ["family", id],
    queryFn: () => getFamilyById({ data: { id } }),
  });

  return (
    <AppShell
      title={family.data ? family.data.family_name : "Family record"}
      description={family.data ? `Family ID ${family.data.family_no}` : undefined}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/families">Back to list</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <FamilyEditor familyId={id} canEdit canEditFamilyId />

        {isAdmin ? (
          <section className="surface p-6">
            <h2 className="text-base font-semibold">Login access</h2>
            {family.data?.wife_user_id ? (
              <FamilyLoginPanel
                familyId={id}
                loginActive={family.data.login_active !== false}
              />
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No login is linked to this family yet.
              </p>
            )}
          </section>
        ) : null}

        <MemberPaymentsPanel familyId={id} />
      </div>
    </AppShell>
  );
}

