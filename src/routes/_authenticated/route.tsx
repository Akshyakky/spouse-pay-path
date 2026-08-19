import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/api/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getSessionUser();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});
