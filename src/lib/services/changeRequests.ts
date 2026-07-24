import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import {
  createChangeRequest,
  getAppointmentByIdUnscoped,
  getChangeRequestById,
  getPendingChangeRequest,
  resolveChangeRequest,
} from "@/lib/repositories/changeRequests";
import { notifySalonMembers } from "@/lib/repositories/notifications";
import { getSettings } from "@/lib/repositories/settings";
import { cancelAppointment, rescheduleAppointment } from "@/lib/services/booking";
import type { AppointmentChangeRequest, ChangeRequestType } from "@/lib/db/types";

const ACTIONABLE_STATUSES = new Set(["pending", "confirmed"]);

/**
 * Customer-facing entry point (called from the public "manage your booking"
 * page, after the caller has already verified the signed token). Never
 * touches the appointment itself — just logs the request and notifies the
 * salon, mirroring how a new booking starts out as a pending request.
 */
export async function submitChangeRequest(input: {
  appointmentId: string;
  type: ChangeRequestType;
  requestedStartsAt?: Date | null;
  customerNote?: string | null;
}): Promise<AppointmentChangeRequest> {
  const appointment = await getAppointmentByIdUnscoped(input.appointmentId);
  if (!appointment) throw ApiError.notFound("Booking not found.");
  if (!ACTIONABLE_STATUSES.has(appointment.status)) {
    throw ApiError.conflict("This booking can no longer be changed.");
  }

  const existing = await getPendingChangeRequest(input.appointmentId);
  if (existing) {
    throw ApiError.conflict(
      "A request for this booking is already awaiting review."
    );
  }

  if (input.type === "cancel") {
    const settings = await getSettings(appointment.salonId);
    if (!settings.allowCancellation) {
      throw ApiError.forbidden(
        "This salon isn't accepting cancellation requests online."
      );
    }
  }

  if (input.type === "reschedule") {
    if (!input.requestedStartsAt) {
      throw ApiError.badRequest("Pick a new time to request a reschedule.");
    }
    if (input.requestedStartsAt.getTime() < Date.now()) {
      throw ApiError.badRequest("That time is in the past.");
    }
  }

  const serviceLabel =
    appointment.services.map((s) => s.serviceName).join(", ") ||
    "appointment";

  return db.transaction(async (tx) => {
    const request = await createChangeRequest(tx, {
      salonId: appointment.salonId,
      appointmentId: appointment.id,
      type: input.type,
      requestedStartsAt: input.requestedStartsAt ?? null,
      customerNote: input.customerNote ?? null,
    });

    await notifySalonMembers(tx, appointment.salonId, {
      type: "change_requested",
      title:
        input.type === "cancel"
          ? "Cancellation requested"
          : "Reschedule requested",
      body: `${appointment.customer.name} asked to ${
        input.type === "cancel" ? "cancel" : "reschedule"
      } their ${serviceLabel} appointment.`,
      appointmentId: appointment.id,
    });

    return request;
  });
}

/**
 * Staff approves a pending request: actually performs the cancel/reschedule
 * (reusing the same booking-service functions staff actions already use)
 * and marks the request resolved.
 */
export async function approveChangeRequest(
  salonId: string,
  requestId: string,
  actor: { type: "user"; userId: string }
): Promise<void> {
  const request = await getChangeRequestById(salonId, requestId);
  if (!request) throw ApiError.notFound("Request not found.");
  if (request.status !== "pending") {
    throw ApiError.conflict("This request has already been resolved.");
  }

  if (request.type === "cancel") {
    await cancelAppointment(
      salonId,
      request.appointmentId,
      "Customer requested cancellation",
      actor
    );
  } else {
    if (!request.requestedStartsAt) {
      throw ApiError.conflict("This request has no proposed time.");
    }
    await rescheduleAppointment(
      salonId,
      request.appointmentId,
      { startsAt: request.requestedStartsAt, allowConflicts: false },
      actor
    );
  }

  await db.transaction(async (tx) => {
    await resolveChangeRequest(tx, salonId, requestId, "approved", actor.userId);
  });
}

/** Staff declines a request — appointment is left completely untouched. */
export async function declineChangeRequest(
  salonId: string,
  requestId: string,
  actor: { type: "user"; userId: string }
): Promise<void> {
  const request = await getChangeRequestById(salonId, requestId);
  if (!request) throw ApiError.notFound("Request not found.");
  if (request.status !== "pending") {
    throw ApiError.conflict("This request has already been resolved.");
  }

  await db.transaction(async (tx) => {
    await resolveChangeRequest(tx, salonId, requestId, "declined", actor.userId);
  });
}
