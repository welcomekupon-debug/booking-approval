import { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { getSalonBySlug } from "@/lib/repositories/salons";
import { createBooking } from "@/lib/services/booking";
import { zUuid } from "@/lib/validators/booking";

const publicBookSchema = z.object({
  salon: z.string().trim().min(1).max(64), // slug
  customer: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(320),
    phone: z.string().trim().max(40).optional().nullable(),
  }),
  serviceIds: z.array(zUuid).min(1).max(10),
  staffId: zUuid.optional().nullable(),
  startsAt: z.coerce.date(),
  note: z.string().trim().max(2000).optional().nullable(),
});

/**
 * POST /api/public/book — the customer-facing booking page endpoint.
 *
 * Unauthenticated but tightly constrained: slug-scoped, availability-checked
 * (conflicts are rejected, unlike the trusted staff/n8n paths), and only ever
 * creates `pending` requests unless the salon enabled auto-confirm.
 *
 * NOTE for launch hardening: add per-IP rate limiting at the edge
 * (Vercel WAF or middleware) — this endpoint is intentionally public.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = publicBookSchema.parse(await request.json());

    const salon = await getSalonBySlug(body.salon);
    if (!salon) throw ApiError.notFound("Salon not found.");

    if (body.startsAt.getTime() < Date.now()) {
      throw ApiError.badRequest("That time is in the past.");
    }

    const appointment = await createBooking(
      {
        salonId: salon.id,
        source: "public",
        customer: body.customer,
        serviceIds: body.serviceIds,
        staffId: body.staffId ?? null,
        startsAt: body.startsAt,
        customerNote: body.note ?? null,
        allowConflicts: false, // strangers can't double-book
      },
      { type: "system" }
    );

    return {
      success: true,
      status: appointment.status,
      startsAt: appointment.startsAt.toISOString(),
    };
  });
}
