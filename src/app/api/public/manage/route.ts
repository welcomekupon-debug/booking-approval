import { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  getAppointmentByIdUnscoped,
  getPendingChangeRequest,
} from "@/lib/repositories/changeRequests";
import { getSalonById } from "@/lib/repositories/salons";
import { getSettings } from "@/lib/repositories/settings";
import { submitChangeRequest } from "@/lib/services/changeRequests";
import { verifyAppointmentToken } from "@/lib/services/manageToken";
import { resolveEntitlements } from "@/lib/entitlements";
import { zUuid } from "@/lib/validators/booking";

/**
 * GET /api/public/manage?id={appointmentId}&token={signedToken}
 *
 * Powers the "manage your booking" page linked from confirmation/reminder
 * emails. Token-gated instead of Clerk-gated — see services/manageToken.ts.
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    await checkRateLimit(`public-manage-get:${getClientIp(request)}`, 30, 60);

    const { id, token } = z
      .strictObject({ id: zUuid, token: z.string().trim().min(1).max(128) })
      .parse(Object.fromEntries(request.nextUrl.searchParams.entries()));

    if (!verifyAppointmentToken(id, token)) {
      throw ApiError.notFound("Booking not found.");
    }

    const appointment = await getAppointmentByIdUnscoped(id);
    if (!appointment) throw ApiError.notFound("Booking not found.");

    const [salon, settings, pending] = await Promise.all([
      getSalonById(appointment.salonId),
      getSettings(appointment.salonId),
      getPendingChangeRequest(id),
    ]);
    if (!salon) throw ApiError.notFound("Booking not found.");

    return {
      appointment: {
        id: appointment.id,
        status: appointment.status,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        serviceNames: appointment.services.map((s) => s.serviceName),
        serviceIds: appointment.services
          .map((s) => s.serviceId)
          .filter((v): v is string => !!v),
        staffId: appointment.staffId,
        staffName: appointment.staff?.name ?? null,
      },
      salon: {
        slug: salon.slug,
        name: salon.name,
        timezone: salon.timezone,
        allowCancellation: settings.allowCancellation,
        selfServiceEnabled: resolveEntitlements(salon).selfServiceBooking,
      },
      pendingRequest: pending
        ? { type: pending.type, createdAt: pending.createdAt.toISOString() }
        : null,
    };
  });
}

const postSchema = z.strictObject({
  appointmentId: zUuid,
  token: z.string().trim().min(1).max(128),
  type: z.enum(["cancel", "reschedule"]),
  requestedStartsAt: z.coerce.date().optional(),
  note: z.string().trim().max(1000).optional().nullable(),
});

/** POST /api/public/manage — submit a cancel/reschedule request. */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await checkRateLimit(`public-manage-post:${getClientIp(request)}`, 10, 60);

    const body = postSchema.parse(await request.json());

    if (!verifyAppointmentToken(body.appointmentId, body.token)) {
      throw ApiError.notFound("Booking not found.");
    }

    await submitChangeRequest({
      appointmentId: body.appointmentId,
      type: body.type,
      requestedStartsAt: body.requestedStartsAt ?? null,
      customerNote: body.note ?? null,
    });

    return { success: true };
  });
}
