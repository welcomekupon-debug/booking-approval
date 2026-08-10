import { handleRoute } from "@/lib/api";
import { requireTenant } from "@/lib/auth/context";
import { fetchAvailableCountries } from "@/lib/services/holidays";

/** GET /api/meta/countries — for the Settings > Business profile country picker. */
export async function GET() {
  return handleRoute(async () => {
    await requireTenant();
    const countries = await fetchAvailableCountries();
    return { countries };
  });
}
