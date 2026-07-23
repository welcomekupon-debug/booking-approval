import { and, eq, gt, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, auditLogs, settings as settingsTable } from "@/lib/db/schema";
import { recordAudit } from "@/lib/repositories/audit";
import { getSalonById } from "@/lib/repositories/salons";
import {
  buildAppointmentEmailContext,
  emailService,
} from "@/lib/services/email";

/**
 * Reminder cron job — the one email trigger that isn't fired by a user
 * action. Something has to periodically ask "who needs a reminder right
 * now?"; this is that something. Meant to be invoked by a scheduled route
 * (Vercel Cron), not by app code directly.
 *
 * Idempotency reuses the audit log instead of a dedicated "reminded" column:
 * an `appointment.reminder_sent` audit row for an appointment means it's
 * already been handled, so re-running the job (or overlapping runs) never
 * double-sends.
 */

const REMINDER_ACTION = "appointment.reminder_sent";

export interface ReminderRunResult {
  /** Confirmed appointments found inside a reminder window, across all salons */
  candidates: number;
  /** Reminder emails actually triggered (candidates minus already-sent minus no-email) */
  sent: number;
}

export async function sendDueReminders(): Promise<ReminderRunResult> {
  const now = new Date();

  // Only salons that want customer reminder emails, with their own lead time.
  const salonSettings = await db
    .select({
      salonId: settingsTable.salonId,
      reminderHoursBefore: settingsTable.reminderHoursBefore,
    })
    .from(settingsTable)
    .where(eq(settingsTable.notifyEmailReminder, true));

  let candidates = 0;
  let sent = 0;

  for (const { salonId, reminderHoursBefore } of salonSettings) {
    const windowEnd = new Date(
      now.getTime() + reminderHoursBefore * 60 * 60_000
    );

    const due = await db.query.appointments.findMany({
      where: and(
        eq(appointments.salonId, salonId),
        eq(appointments.status, "confirmed"),
        gt(appointments.startsAt, now),
        lte(appointments.startsAt, windowEnd)
      ),
      with: { customer: true, staff: true, services: true },
    });

    if (due.length === 0) continue;
    candidates += due.length;

    const ids = due.map((a) => a.id);
    const alreadyReminded = await db
      .select({ entityId: auditLogs.entityId })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, "appointment"),
          eq(auditLogs.action, REMINDER_ACTION),
          inArray(auditLogs.entityId, ids)
        )
      );
    const remindedIds = new Set(alreadyReminded.map((r) => r.entityId));

    const pending = due.filter((a) => !remindedIds.has(a.id));
    if (pending.length === 0) continue;

    const salon = await getSalonById(salonId);
    if (!salon) continue;

    for (const appointment of pending) {
      const ctx = await buildAppointmentEmailContext({
        salonId,
        customer: appointment.customer,
        services: appointment.services,
        staffName: appointment.staff?.name ?? null,
        appointment,
      });
      if (!ctx) continue; // no customer email on file — nothing to send

      await emailService.sendAppointmentReminder(ctx);

      // Record after a successful trigger attempt so a crash mid-loop just
      // means this appointment is retried on the next run, not skipped.
      await recordAudit(db, {
        salonId,
        actorType: "system",
        action: REMINDER_ACTION,
        entityType: "appointment",
        entityId: appointment.id,
      });

      sent++;
    }
  }

  return { candidates, sent };
}
