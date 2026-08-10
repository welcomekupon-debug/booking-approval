import { handleRoute } from "@/lib/api";
import { requirePlatformAdmin } from "@/lib/auth/context";
import { listAllSalonsForAdmin } from "@/lib/repositories/salons";

/** GET /api/admin/salons — every salon, for the platform-admin picker. */
export async function GET() {
  return handleRoute(async () => {
    await requirePlatformAdmin();
    const rows = await listAllSalonsForAdmin();

    return {
      salons: rows.map(({ salon, owners }) => ({
        id: salon.id,
        name: salon.name,
        slug: salon.slug,
        category: salon.category,
        createdAt: salon.createdAt.toISOString(),
        owners,
      })),
    };
  });
}
