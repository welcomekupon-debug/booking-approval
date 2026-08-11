import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointmentServices, customers } from "@/lib/db/schema";
import { listServices } from "@/lib/repositories/catalog";
import { ApiError } from "@/lib/errors";
import type {
  Appointment,
  AppointmentSource,
  AppointmentStatus,
} from "@/lib/db/types";
import {
  findConflicts,
  getAppointmentById,
  getByExternalRef,
  insertAppointment,
  updateAppointment,
} from "@/lib/repositories/appointments";
import { getServicesByIds, getStaffById } from "@/lib/repositories/catalog";
import { findOrCreateCustomer } from "@/lib/repositories/customers";
import { getSettings } from "@/lib/repositories/settings";
import { notifySalonMembers } from "@/lib/repositories/notifications";
import { recordAudit } from "@/lib/repositories/audit";
import { emailService, buildAppointmentEmailContext } from "@/lib/services/email";
import { effectivePriceCents } from "@/lib/services/pricing";

/**
 * Booking service — every appointment mutation flows through here so that
 * conflict checks, snapshots, audit logging, and notifications are never
 * skipped. All writes are transactional.
 */

interface Actor {
  type: "user" | "api_key" | "system";
  userId?: string;
  apiKeyId?: string;
}

export interface CreateBookingInput {
  salonId: string;
  source: AppointmentSource;
  customer: { name: string; email?: string | null; phone?: string | null };
  serviceIds: string[];
  staffId?: string | null;
  /** UTC instant */
  startsAt: Date;
  customerNote?: string | null;
  internalNote?: string | null;
  /** Idempotency key for webhook callers (e.g. Tally submission id) */
  externalRef?: string | null;
  /**
   * Staff can double-book deliberately (walk-ins, squeezing someone in);
   * public/webhook callers can't.
   */
  allowConflicts?: boolean;
}

export async function createBooking(
  input: CreateBookingInput,
  actor: Actor
): Promise<Appointment> {
  // Idempotency: same external ref → return the existing appointment
  if (input.externalRef) {
    const existing = await getByExternalRef(input.salonId, input.externalRef);
    if (existing) return existing;
  }

  const [settings, services] = await Promise.all([
    getSettings(input.salonId),
    getServicesByIds(input.salonId, input.serviceIds),
  ]);

  if (input.serviceIds.length > 0 && services.length !== input.serviceIds.length) {
    throw ApiError.badRequest("One or more services do not exist.");
  }

  const durationMinutes =
    services.reduce((sum, s) => sum + s.durationMinutes, 0) ||
    settings.defaultDurationMinutes;
  const bufferBefore = Math.max(
    settings.defaultBufferBeforeMinutes,
    ...services.map((s) => s.bufferBeforeMinutes),
    0
  );
  const bufferAfter = Math.max(
    settings.defaultBufferAfterMinutes,
    ...services.map((s) => s.bufferAfterMinutes),
    0
  );
  // Promo prices (if live right now) are snapshotted onto the appointment at
  // booking time — later promo changes or expirations never retroactively
  // touch appointments that are already booked.
  const priceTotalCents = services.reduce(
    (sum, s) => sum + effectivePriceCents(s),
    0
  );

  const startsAt = input.startsAt;
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  const status: AppointmentStatus =
    input.source === "staff" || settings.autoConfirm ? "confirmed" : "pending";

  const { appointment, customer } = await db.transaction(async (tx) => {
    if (!input.allowConflicts) {
      const conflicts = await findConflicts(
        tx,
        input.salonId,
        {
          start: new Date(startsAt.getTime() - bufferBefore * 60_000),
          end: new Date(endsAt.getTime() + bufferAfter * 60_000),
        },
        input.staffId ?? undefined
      );
      if (conflicts.length > 0) {
        throw ApiError.conflict(
          "That time is no longer available. Please pick another slot."
        );
      }
    }

    const customer = await findOrCreateCustomer(tx, input.salonId, input.customer);

    const appointment = await insertAppointment(
      tx,
      {
        salonId: input.salonId,
        customerId: customer.id,
        staffId: input.staffId ?? null,
        status,
        source: input.source,
        startsAt,
        endsAt,
        bufferBeforeMinutes: bufferBefore,
        bufferAfterMinutes: bufferAfter,
        priceTotalCents,
        customerNote: input.customerNote ?? null,
        internalNote: input.internalNote ?? null,
        externalRef: input.externalRef ?? null,
      },
      services.map((s, i) => ({
        serviceId: s.id,
        serviceName: s.name,
        durationMinutes: s.durationMinutes,
        priceCents: effectivePriceCents(s),
        sortOrder: i,
      }))
    );

    await recordAudit(tx, {
      salonId: input.salonId,
      actorType: actor.type,
      actorUserId: actor.userId,
      actorApiKeyId: actor.apiKeyId,
      action: `appointment.created.${status}`,
      entityType: "appointment",
      entityId: appointment.id,
      changes: { source: input.source, startsAt, services: services.map((s) => s.name) },
    });

    if (status === "pending") {
      await notifySalonMembers(tx, input.salonId, {
        type: "new_request",
        title: "New booking request",
        body: `${customer.name} requested ${services.map((s) => s.name).join(", ") || "an appointment"}.`,
        appointmentId: appointment.id,
      });
    }

    return { appointment, customer };
  });

  // Fire the confirmation email after the transaction has committed — never
  // let an n8n/webhook hiccup roll back (or even delay failing) the booking.
  if (appointment.status === "confirmed" && settings.notifyEmailConfirmation) {
    const staff = appointment.staffId
      ? await getStaffById(input.salonId, appointment.staffId)
      : null;
    const ctx = await buildAppointmentEmailContext({
      salonId: input.salonId,
      customer: { name: customer.name, email: customer.email, phone: customer.phone },
      services,
      staffName: staff?.name ?? null,
      appointment,
    });
    if (ctx) await emailService.sendBookingConfirmation(ctx);
  }

  return appointment;
}

/** Confirm or decline a pending request. */
export async function decideAppointment(
  salonId: string,
  appointmentId: string,
  decision: "confirmed" | "declined",
  actor: Actor
): Promise<Appointment> {
  const existing = await getAppointmentById(salonId, appointmentId);
  if (!existing) throw ApiError.notFound("Appointment not found.");
  if (existing.status !== "pending") {
    throw ApiError.conflict(`Only pending requests can be ${decision}.`);
  }

  const updated = await db.transaction(async (tx) => {
    const updated = await updateAppointment(tx, salonId, appointmentId, {
      status: decision,
    });
    if (!updated) throw ApiError.notFound("Appointment not found.");

    await recordAudit(tx, {
      salonId,
      actorType: actor.type,
      actorUserId: actor.userId,
      action: `appointment.${decision}`,
      entityType: "appointment",
      entityId: appointmentId,
    });

    return updated;
  });

  if (decision === "confirmed") {
    const settings = await getSettings(salonId);
    if (settings.notifyEmailConfirmation) {
      const ctx = await buildAppointmentEmailContext({
        salonId,
        customer: existing.customer,
        services: existing.services,
        staffName: existing.staff?.name ?? null,
        appointment: updated,
      });
      if (ctx) await emailService.sendBookingConfirmation(ctx);
    }
  }

  return updated;
}

/** Cancel a confirmed appointment (salon side). */
export async function cancelAppointment(
  salonId: string,
  appointmentId: string,
  reason: string | null,
  actor: Actor
): Promise<Appointment> {
  const existing = await getAppointmentById(salonId, appointmentId);
  if (!existing) throw ApiError.notFound("Appointment not found.");
  if (existing.status !== "confirmed" && existing.status !== "pending") {
    throw ApiError.conflict("Only pending or confirmed appointments can be cancelled.");
  }

  const updated = await db.transaction(async (tx) => {
    const updated = await updateAppointment(tx, salonId, appointmentId, {
      status: "cancelled",
      cancellationReason: reason,
      cancelledAt: new Date(),
      cancelledByUserId: actor.userId ?? null,
    });
    if (!updated) throw ApiError.notFound("Appointment not found.");

    await recordAudit(tx, {
      salonId,
      actorType: actor.type,
      actorUserId: actor.userId,
      action: "appointment.cancelled",
      entityType: "appointment",
      entityId: appointmentId,
      changes: { reason },
    });

    return updated;
  });

  const ctx = await buildAppointmentEmailContext({
    salonId,
    customer: existing.customer,
    services: existing.services,
    staffName: existing.staff?.name ?? null,
    appointment: updated,
  });
  if (ctx) await emailService.sendCancellationEmail(ctx, reason);

  return updated;
}

/** Move an appointment to a new time (and optionally another staff member). */
export async function rescheduleAppointment(
  salonId: string,
  appointmentId: string,
  input: { startsAt: Date; staffId?: string | null; allowConflicts?: boolean },
  actor: Actor
): Promise<Appointment> {
  const existing = await getAppointmentById(salonId, appointmentId);
  if (!existing) throw ApiError.notFound("Appointment not found.");
  if (existing.status === "cancelled" || existing.status === "declined") {
    throw ApiError.conflict("Cancelled appointments can't be rescheduled.");
  }

  const durationMs =
    existing.endsAt.getTime() - existing.startsAt.getTime();
  const startsAt = input.startsAt;
  const endsAt = new Date(startsAt.getTime() + durationMs);
  const staffId =
    input.staffId !== undefined ? input.staffId : existing.staffId;

  const previousStartsAt = existing.startsAt;

  const updated = await db.transaction(async (tx) => {
    if (!input.allowConflicts) {
      const conflicts = await findConflicts(
        tx,
        salonId,
        {
          start: new Date(
            startsAt.getTime() - existing.bufferBeforeMinutes * 60_000
          ),
          end: new Date(endsAt.getTime() + existing.bufferAfterMinutes * 60_000),
        },
        staffId ?? undefined,
        appointmentId
      );
      if (conflicts.length > 0) {
        throw ApiError.conflict("That time conflicts with another appointment.");
      }
    }

    const updated = await updateAppointment(tx, salonId, appointmentId, {
      startsAt,
      endsAt,
      staffId,
    });
    if (!updated) throw ApiError.notFound("Appointment not found.");

    await recordAudit(tx, {
      salonId,
      actorType: actor.type,
      actorUserId: actor.userId,
      action: "appointment.rescheduled",
      entityType: "appointment",
      entityId: appointmentId,
      changes: {
        from: existing.startsAt,
        to: startsAt,
        staffId,
      },
    });

    return updated;
  });

  // Staff may have changed as part of the reschedule — re-resolve the name
  // instead of trusting the pre-reschedule snapshot.
  const staffName =
    staffId === existing.staffId
      ? (existing.staff?.name ?? null)
      : staffId
        ? ((await getStaffById(salonId, staffId))?.name ?? null)
        : null;

  const ctx = await buildAppointmentEmailContext({
    salonId,
    customer: existing.customer,
    services: existing.services,
    staffName,
    appointment: updated,
  });
  if (ctx) await emailService.sendRescheduleEmail(ctx, previousStartsAt);

  return updated;
}

export interface EditAppointmentInput {
  internalNote?: string;
  customerPhone?: string;
  /** Replace line items with this catalog service (resolved by name) */
  serviceName?: string;
  durationMinutes?: number;
  priceTotalCents?: number;
  staffId?: string | null;
}

/**
 * Field-level edits from the appointment drawer. Service replacement
 * re-snapshots price/duration from the catalog; explicit duration/price
 * override afterwards.
 */
export async function editAppointment(
  salonId: string,
  appointmentId: string,
  input: EditAppointmentInput,
  actor: Actor
): Promise<Appointment> {
  const existing = await getAppointmentById(salonId, appointmentId);
  if (!existing) throw ApiError.notFound("Appointment not found.");

  return db.transaction(async (tx) => {
    const patch: Record<string, unknown> = {};
    let durationMinutes: number | undefined = input.durationMinutes;

    if (input.serviceName !== undefined) {
      const catalog = await listServices(salonId, { includeInactive: true });
      const match = catalog.find(
        (s) => s.name.toLowerCase() === input.serviceName!.trim().toLowerCase()
      );

      await tx
        .delete(appointmentServices)
        .where(eq(appointmentServices.appointmentId, appointmentId));

      if (match) {
        const matchPriceCents = effectivePriceCents(match);
        await tx.insert(appointmentServices).values({
          salonId,
          appointmentId,
          serviceId: match.id,
          serviceName: match.name,
          durationMinutes: match.durationMinutes,
          priceCents: matchPriceCents,
          sortOrder: 0,
        });
        durationMinutes = durationMinutes ?? match.durationMinutes;
        patch.priceTotalCents = input.priceTotalCents ?? matchPriceCents;
      } else if (input.serviceName.trim()) {
        await tx.insert(appointmentServices).values({
          salonId,
          appointmentId,
          serviceId: null,
          serviceName: input.serviceName.trim(),
          durationMinutes:
            durationMinutes ??
            Math.round(
              (existing.endsAt.getTime() - existing.startsAt.getTime()) / 60_000
            ),
          priceCents: input.priceTotalCents ?? existing.priceTotalCents,
          sortOrder: 0,
        });
      }
    }

    if (input.internalNote !== undefined) patch.internalNote = input.internalNote;
    if (input.staffId !== undefined) patch.staffId = input.staffId;
    if (input.priceTotalCents !== undefined) {
      patch.priceTotalCents = input.priceTotalCents;
    }
    if (durationMinutes !== undefined && durationMinutes > 0) {
      patch.endsAt = new Date(
        existing.startsAt.getTime() + durationMinutes * 60_000
      );
    }

    if (input.customerPhone !== undefined) {
      await tx
        .update(customers)
        .set({ phone: input.customerPhone || null, updatedAt: new Date() })
        .where(
          and(
            eq(customers.id, existing.customerId),
            eq(customers.salonId, salonId)
          )
        );
    }

    const updated =
      Object.keys(patch).length > 0
        ? await updateAppointment(tx, salonId, appointmentId, patch)
        : existing;
    if (!updated) throw ApiError.notFound("Appointment not found.");

    await recordAudit(tx, {
      salonId,
      actorType: actor.type,
      actorUserId: actor.userId,
      action: "appointment.edited",
      entityType: "appointment",
      entityId: appointmentId,
      changes: input,
    });

    return updated;
  });
}

/** Bring a declined/cancelled appointment back to confirmed. */
export async function restoreAppointment(
  salonId: string,
  appointmentId: string,
  actor: Actor
): Promise<Appointment> {
  const existing = await getAppointmentById(salonId, appointmentId);
  if (!existing) throw ApiError.notFound("Appointment not found.");
  if (existing.status !== "declined" && existing.status !== "cancelled") {
    throw ApiError.conflict("Only declined or cancelled appointments can be restored.");
  }

  return db.transaction(async (tx) => {
    const updated = await updateAppointment(tx, salonId, appointmentId, {
      status: "confirmed",
      cancellationReason: null,
      cancelledAt: null,
      cancelledByUserId: null,
    });
    if (!updated) throw ApiError.notFound("Appointment not found.");

    await recordAudit(tx, {
      salonId,
      actorType: actor.type,
      actorUserId: actor.userId,
      action: "appointment.restored",
      entityType: "appointment",
      entityId: appointmentId,
    });

    return updated;
  });
}

/** Post-visit bookkeeping. */
export async function markOutcome(
  salonId: string,
  appointmentId: string,
  outcome: "completed" | "no_show",
  actor: Actor
): Promise<Appointment> {
  const existing = await getAppointmentById(salonId, appointmentId);
  if (!existing) throw ApiError.notFound("Appointment not found.");
  if (existing.status !== "confirmed") {
    throw ApiError.conflict("Only confirmed appointments can be marked.");
  }

  return db.transaction(async (tx) => {
    const updated = await updateAppointment(tx, salonId, appointmentId, {
      status: outcome,
    });
    if (!updated) throw ApiError.notFound("Appointment not found.");

    await recordAudit(tx, {
      salonId,
      actorType: actor.type,
      actorUserId: actor.userId,
      action: `appointment.${outcome}`,
      entityType: "appointment",
      entityId: appointmentId,
    });

    return updated;
  });
}
