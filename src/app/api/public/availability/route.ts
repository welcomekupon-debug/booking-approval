export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { getSalonBySlug } from "@/lib/repositories/salons";
import { getAvailableSlotsForRange } from "@/lib/services/availability";
import { availabilityQuerySchema } from "@/lib/validators/booking";

/**
 * GET /api/public/availability?salon={slug}&date=YYYY-MM-DD&days=7&serviceIds=…
 *
 * Unauthenticated (it powers the public booking page), but only exposes
 * free/busy slots — never appointment details. Rate limiting should be added
 * at the edge (Vercel WAF / middleware) before heavy public launch.
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = availabilityQuerySchema.parse({
      ...params,
      serviceIds: params.serviceIds ?? "",
    });

    const salon = await getSalonBySlug(query.salon);
    if (!salon) throw ApiError.notFound("Salon not found.");

    const slots = await getAvailableSlotsForRange({
      salonId: salon.id,
      fromDate: query.date,
      days: query.days,
      serviceIds: query.serviceIds,
      staffId: query.staffId,
      granularityMinutes: query.granularityMinutes,
    });

    return {
      salon: { name: salon.name, timezone: salon.timezone },
      slots: Object.fromEntries(
        Object.entries(slots).map(([date, daySlots]) => [
          date,
          daySlots.map((s) => ({
            startsAt: s.startsAt.toISOString(),
            endsAt: s.endsAt.toISOString(),
            staffId: s.staffId,
          })),
        ])
      ),
    };
  });
}
