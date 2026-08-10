import { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/api";
import { requireTenant } from "@/lib/auth/context";
import { fetchPublicHolidays } from "@/lib/services/holidays";

const querySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100)
    .default(new Date().getFullYear()),
  // Optional override so the Settings UI can preview suggestions for a
  // country that's been picked in the form but not saved yet.
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional(),
});

/**
 * GET /api/holidays/suggestions?year=2026[&country=SI] — public holidays for
 * the given country, defaulting to whatever's saved on the salon (Settings >
 * Business profile) when `country` isn't passed.
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    const { year, country: countryOverride } = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );

    const country = countryOverride ?? ctx.salon.country;
    if (!country) {
      return { country: null, year, holidays: [] };
    }

    const holidays = await fetchPublicHolidays(country, year);
    return { country, year, holidays };
  });
}
