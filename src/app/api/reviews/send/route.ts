import { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireTenant } from "@/lib/auth/context";
import { sendReviewRequestsForDay } from "@/lib/services/reviews";
import { sendReviewRequestsSchema } from "@/lib/validators/reviews";

/**
 * POST /api/reviews/send — manually send review requests for one calendar
 * day. Any signed-in team member can trigger this (it's an end-of-day
 * operational action, not a settings change) — no role floor.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const ctx = await requireTenant();

    const { date } = sendReviewRequestsSchema.parse(await request.json());
    const result = await sendReviewRequestsForDay(ctx, date);

    return result;
  });
}
