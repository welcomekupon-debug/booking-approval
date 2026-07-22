import { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { verifyApiKey } from "@/lib/repositories/apiKeys";
import { listServices } from "@/lib/repositories/catalog";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { salons } from "@/lib/db/schema";
import { createBooking } from "@/lib/services/booking";
import { localDateTimeToUtc } from "@/lib/services/timezone";
import { publicBookingSchema } from "@/lib/validators/booking";

/**
 * POST /api/public/bookings — machine entry point for booking requests.
 *
 * This replaces "n8n appends a row to the Google Sheet": point the n8n HTTP
 * node here with the salon's API key. Idempotent on `externalRef` (send the
 * Tally submission id), so webhook retries can't create duplicates.
 *
 *   Authorization: Bearer bk_live_…
 *   { customer: {name, email?, phone?}, serviceIds? | serviceName?,
 *     startsAt? | (date + time, salon-local), note?, externalRef? }
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const auth = request.headers.get("authorization") ?? "";
    const rawKey = auth.replace(/^Bearer\s+/i, "").trim();
    if (!rawKey) throw ApiError.unauthorized("Missing API key.");

    const key = await verifyApiKey(rawKey);
    if (!key) throw ApiError.unauthorized("Invalid or revoked API key.");

    const body = publicBookingSchema.parse(await request.json());

    const salon = await db.query.salons.findFirst({
      where: eq(salons.id, key.salonId),
    });
    if (!salon) throw ApiError.notFound("Salon not found.");

    // Resolve start instant: explicit UTC, or salon-local date+time
    let startsAt: Date;
    if (body.startsAt) {
      startsAt = body.startsAt;
    } else if (body.date && body.time) {
      startsAt = localDateTimeToUtc(body.date, body.time, salon.timezone);
    } else {
      throw ApiError.badRequest(
        "Provide either startsAt (UTC) or date + time (salon-local)."
      );
    }

    // Resolve services: by id, or by name (Tally sends the service label)
    let serviceIds = body.serviceIds;
    if (serviceIds.length === 0 && body.serviceName) {
      const catalog = await listServices(key.salonId, { includeInactive: false });
      const match = catalog.find(
        (s) => s.name.toLowerCase() === body.serviceName!.trim().toLowerCase()
      );
      if (match) serviceIds = [match.id];
    }

    const appointment = await createBooking(
      {
        salonId: key.salonId,
        source: "tally",
        customer: body.customer,
        serviceIds,
        staffId: body.staffId ?? null,
        startsAt,
        customerNote: body.note ?? null,
        externalRef: body.externalRef ?? null,
        // Webhook bookings are requests — conflicts surface to the salon as
        // pending items rather than being rejected at the form.
        allowConflicts: true,
      },
      { type: "api_key", apiKeyId: key.apiKeyId }
    );

    return {
      success: true,
      appointmentId: appointment.id,
      status: appointment.status,
    };
  });
}
