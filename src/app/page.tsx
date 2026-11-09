import { redirect } from "next/navigation";
import { getSession, hasPermission } from "@/lib/auth";
import DashboardView from "./dashboard-view";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <DashboardView
      user={{
        name: session.name,
        email: session.email,
        role: session.role,
        canSync: hasPermission(session, "tickets.sync"),
      }}
    />
  );
}
