import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-gray-500">
            Welcome, {session.user.name}
          </p>
        </div>
        <SignOutButton />
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Profile</h2>
        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-sm text-gray-500">Name</dt>
            <dd className="text-sm font-medium">{session.user.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Email</dt>
            <dd className="text-sm font-medium">{session.user.email}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
