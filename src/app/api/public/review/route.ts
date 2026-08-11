import { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { getPublicReviewData, submitReview } from "@/lib/services/reviews";
import { submitReviewSchema } from "@/lib/validators/reviews";
import { zUuid } from "@/lib/validators/booking";

/**
 * GET /api/public/review?id={appointmentId}&token={signedToken}
 *
 * Powers the public star-rating page linked from the manually-sent review
 * request email. Token-gated instead of Clerk-gated — same signed link
 * scheme as "manage your booking" (see services/manageToken.ts).
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    await checkRateLimit(`public-review-get:${getClientIp(request)}`, 30, 60);

    const { id, token } = z
      .strictObject({ id: zUuid, token: z.string().trim().min(1).max(128) })
      .parse(Object.fromEntries(request.nextUrl.searchParams.entries()));

    const data = await getPublicReviewData(id, token);
    if (!data) throw ApiError.notFound("Review link not found.");

    return {
      appointment: {
        id: data.appointment.id,
        date: data.appointment.startsAt.toISOString(),
        serviceNames: data.appointment.services.map((s) => s.serviceName),
        staffName: data.appointment.staff?.name ?? null,
      },
      salon: {
        name: data.salon.name,
        logoUrl: data.salon.logoUrl,
        googleReviewUrl: data.salon.googleReviewUrl,
      },
      alreadyReviewed: data.alreadyReviewed,
    };
  });
}

/** POST /api/public/review — submit a 1-5 star rating + optional comment. */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await checkRateLimit(`public-review-post:${getClientIp(request)}`, 10, 60);

    const body = submitReviewSchema.parse(await request.json());

    await submitReview(body.appointmentId, body.token, {
      rating: body.rating,
      comment: body.comment,
    });

    return { success: true };
  });
}
