import type { Metadata } from "next";
import { getOrCreateUser } from "@/lib/auth/context";
import { listAllSalonsForAdmin } from "@/lib/repositories/salons";
import { AdminSalonPicker } from "@/components/admin/AdminSalonPicker";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Platform admin" };
}

/**
 * Standalone route — deliberately outside `(app)` so it never goes through
 * WorkspaceProvider/AppShell (which assumes the signed-in user already has a
 * salon and redirects into onboarding otherwise). A platform admin may have
 * no salon of their own at all.
 */
export default async function AdminPage() {
  const user = await getOrCreateUser();

  if (!user || !user.isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-[rgb(var(--bg))] flex items-center justify-center px-4">
        <p className="text-sm text-ink-400">
          {user ? "This account doesn't have platform admin access." : "Sign in required."}
        </p>
      </div>
    );
  }

  const rows = await listAllSalonsForAdmin();

  return (
    <AdminSalonPicker
      salons={rows.map(({ salon, owners }) => ({
        id: salon.id,
        name: salon.name,
        slug: salon.slug,
        category: salon.category,
        plan: salon.plan,
        customEntitlements: {
          maxStaff: salon.customMaxStaff,
          analytics: salon.customAnalytics,
          selfServiceBooking: salon.customSelfServiceBooking,
          apiAccess: salon.customApiAccess,
        },
        createdAt: salon.createdAt.toISOString(),
        owners,
      }))}
    />
  );
}
