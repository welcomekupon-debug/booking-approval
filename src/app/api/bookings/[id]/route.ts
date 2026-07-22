import { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireTenant } from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import { getAppointmentById } from "@/lib/repositories/appointments";
import { listStaff } from "@/lib/repositories/catalog";
import {
  cancelAppointment,
  decideAppointment,
  editAppointment,
  rescheduleAppointment,
  restoreAppointment,
} from "@/lib/services/booking";
import { localDateTimeToUtc, utcToWall } from "@/lib/services/timezone";
import { decimalToCents, legacyDateToIso } from "@/lib/legacy/mapper";
import type { BookingUpdatePayload } from "@/types/booking";

/**
 * Legacy-shaped PATCH kept for the current UI, translated onto the booking
 * service. `id` is the appointment UUID.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { id } = await params;
    const ctx = await requireTenant();
    const salonId = ctx.salon.id;
    const actor = { type: "user" as const, userId: ctx.user.id };

    const body = (await request.json().catch(() => null)) as
      | BookingUpdatePayload
      | null;
    if (!body) throw ApiError.badRequest("Invalid JSON body.");

    const existing = await getAppointmentById(salonId, id);
    if (!existing) throw ApiError.notFound("Booking not found.");

    // ── Status transitions ───────────────────────────────────────────────
    if (body.status !== undefined) {
      if (body.status !== "Confirmed" && body.status !== "Declined") {
        throw ApiError.badRequest('Status must be "Confirmed" or "Declined".');
      }

      if (existing.status === "pending") {
        await decideAppointment(
          salonId,
          id,
          body.status === "Confirmed" ? "confirmed" : "declined",
          actor
        );
      } else if (body.status === "Declined") {
        await cancelAppointment(salonId, id, null, actor);
      } else {
        await restoreAppointment(salonId, id, actor);
      }
    }

    // ── Reschedule (datum / ura) ─────────────────────────────────────────
    if (body.datum !== undefined || body.ura !== undefined) {
      const tz = ctx.salon.timezone;
      const currentWall = utcToWall(existing.startsAt, tz);
      const currentIso = `${currentWall.year}-${String(currentWall.month).padStart(2, "0")}-${String(currentWall.day).padStart(2, "0")}`;
      const currentTime = `${String(currentWall.hour).padStart(2, "0")}:${String(currentWall.minute).padStart(2, "0")}`;

      const dateIso = body.datum ? legacyDateToIso(body.datum) : currentIso;
      const time = body.ura?.trim() || currentTime;
      if (!dateIso) throw ApiError.badRequest("Invalid date format.");
      if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) {
        throw ApiError.badRequest("Invalid time format.");
      }

      const startsAt = localDateTimeToUtc(dateIso, time, tz);
      if (
        startsAt.getTime() !== existing.startsAt.getTime()
      ) {
        // Drag-and-drop reschedules are staff actions — allow deliberate
        // conflicts, the calendar shows them side by side.
        await rescheduleAppointment(
          salonId,
          id,
          { startsAt, allowConflicts: true },
          actor
        );
      }
    }

    // ── Field edits ──────────────────────────────────────────────────────
    const edits: Parameters<typeof editAppointment>[2] = {};
    if (body.notes !== undefined) edits.internalNote = body.notes;
    if (body.phone !== undefined) edits.customerPhone = body.phone;
    if (body.service !== undefined) edits.serviceName = body.service;
    if (body.duration !== undefined) {
      const mins = parseInt(body.duration, 10);
      if (!isNaN(mins) && mins > 0) edits.durationMinutes = mins;
    }
    if (body.price !== undefined) {
      const cents = decimalToCents(body.price);
      if (cents !== null) edits.priceTotalCents = cents;
    }
    if (body.staff !== undefined) {
      if (!body.staff.trim()) {
        edits.staffId = null;
      } else {
        const staffList = await listStaff(salonId, { includeInactive: true });
        const match = staffList.find(
          (s) => s.name.toLowerCase() === body.staff!.trim().toLowerCase()
        );
        if (match) edits.staffId = match.id;
      }
    }

    if (Object.keys(edits).length > 0) {
      await editAppointment(salonId, id, edits, actor);
    }

    return { success: true, updatedAt: new Date().toISOString() };
  });
}
