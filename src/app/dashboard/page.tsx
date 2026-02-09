import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { document } from "@/db/schema";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const documents = await db
    .select()
    .from(document)
    .where(eq(document.userId, session.user.id))
    .orderBy(desc(document.createdAt));

  return (
    <DashboardShell
      user={{ name: session.user.name, email: session.user.email }}
      initialDocuments={documents}
    />
  );
}
