import type { Salon } from "@/lib/db/types";
import { getSalonById } from "@/lib/repositories/salons";

/**
 * Email service — the ONLY thing in this app that knows an n8n webhook
 * exists. It never sends email itself: it POSTs event data to n8n, and n8n
 * owns formatting + delivery via Resend.
 *
 *   Appointment mutation → emailService.sendXxx() → POST n8n webhook → n8n formats + sends via Resend
 *
 * A broken or unconfigured webhook must never break a booking mutation, so
 * every failure here is logged and swallowed, not thrown.
 *
 * Webhook URL resolution: by default every event POSTs to the same
 * `N8N_EMAIL_WEBHOOK_URL`, with the event name in the payload so a single
 * n8n workflow can Switch on it. If you'd rather split events into separate
 * n8n workflows, set the matching per-event env var (see EVENT_ENV_VAR
 * below) — it's checked first and falls back to the shared URL, so you can
 * migrate one event at a time without touching this file.
 */

export type EmailEvent =
  | "booking_confirmation"
  | "appointment_reminder"
  | "cancellation"
  | "reschedule";

export interface EmailSalonInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  currency: string;
}

export interface EmailCustomerInfo {
  name: string;
  email: string;
  phone: string | null;
}

export interface EmailAppointmentInfo {
  id: string;
  /** ISO instants, for templates that want to format them themselves */
  startsAt: string;
  endsAt: string;
  status: string;
  services: string[];
  /** services.join(", ") — convenience for templates expecting one field */
  serviceName: string;
  /** Pre-formatted in the salon's own timezone, e.g. "Friday, 24 July 2026" */
  date: string;
  /** Pre-formatted in the salon's own timezone, e.g. "14:30" */
  time: string;
  /** "" (never null) — templates interpolate this directly with no fallback */
  staffName: string;
  priceTotalCents: number;
  notes: string | null;
}

export interface AppointmentEmailContext {
  salon: EmailSalonInfo;
  customer: EmailCustomerInfo;
  appointment: EmailAppointmentInfo;
}

interface EmailPayload extends AppointmentEmailContext {
  event: EmailEvent;
  /** Event-specific extras (e.g. cancellation reason, previous appointment time) */
  meta?: Record<string, unknown>;
}

const EVENT_ENV_VAR: Record<EmailEvent, string> = {
  booking_confirmation: "N8N_WEBHOOK_URL_BOOKING_CONFIRMATION",
  appointment_reminder: "N8N_WEBHOOK_URL_APPOINTMENT_REMINDER",
  cancellation: "N8N_WEBHOOK_URL_CANCELLATION",
  reschedule: "N8N_WEBHOOK_URL_RESCHEDULE",
};

function resolveWebhookUrl(event: EmailEvent): string | null {
  const override = process.env[EVENT_ENV_VAR[event]];
  // N8N_SALON_WEBHOOK_URL is an accepted alias for N8N_EMAIL_WEBHOOK_URL —
  // both names have been used in setup instructions, so honor whichever is set.
  return (
    override ||
    process.env.N8N_EMAIL_WEBHOOK_URL ||
    process.env.N8N_SALON_WEBHOOK_URL ||
    null
  );
}

async function triggerWebhook(payload: EmailPayload): Promise<void> {
  const url = resolveWebhookUrl(payload.event);
  if (!url) {
    console.warn(
      `[email] No n8n webhook configured for "${payload.event}" — set N8N_EMAIL_WEBHOOK_URL (or ${EVENT_ENV_VAR[payload.event]}). Skipping.`
    );
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.N8N_WEBHOOK_SECRET
          ? { "X-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(
        `[email] n8n webhook for "${payload.event}" responded ${res.status}`
      );
    }
  } catch (err) {
    // Never let a webhook outage break the booking mutation that triggered it.
    console.error(`[email] failed to trigger "${payload.event}" webhook`, err);
  } finally {
    clearTimeout(timeout);
  }
}

const dateFmtCache = new Map<string, Intl.DateTimeFormat>();
const timeFmtCache = new Map<string, Intl.DateTimeFormat>();

/** e.g. "Friday, 24 July 2026" in the given salon's own timezone. */
function formatEmailDate(instant: Date, timeZone: string): string {
  let fmt = dateFmtCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone,
    });
    dateFmtCache.set(timeZone, fmt);
  }
  return fmt.format(instant);
}

/** e.g. "14:30" in the given salon's own timezone. */
function formatEmailTime(instant: Date, timeZone: string): string {
  let fmt = timeFmtCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    });
    timeFmtCache.set(timeZone, fmt);
  }
  return fmt.format(instant);
}

/** Shape a Salon row for the email payload — same projection everywhere. */
export function toEmailSalonInfo(salon: Salon): EmailSalonInfo {
  return {
    id: salon.id,
    name: salon.name,
    email: salon.email,
    phone: salon.phone,
    timezone: salon.timezone,
    currency: salon.currency,
  };
}

/**
 * Assembles the payload every email trigger needs (salon + customer +
 * appointment) from whatever pieces the caller already has in hand — booking
 * mutations, the reminder cron job, anything future. Returns null when
 * there's nowhere to send it (no customer email on file, or the salon
 * vanished mid-request) so call sites can no-op instead of branching twice.
 */
export async function buildAppointmentEmailContext(params: {
  salonId: string;
  customer: { name: string; email: string | null; phone: string | null };
  services: { name: string }[] | { serviceName: string }[];
  staffName: string | null;
  appointment: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
    priceTotalCents: number;
    customerNote: string | null;
  };
}): Promise<AppointmentEmailContext | null> {
  if (!params.customer.email) return null;

  const salon = await getSalonById(params.salonId);
  if (!salon) return null;

  const services = params.services.map((s) => ("name" in s ? s.name : s.serviceName));

  return {
    salon: toEmailSalonInfo(salon),
    customer: {
      name: params.customer.name,
      email: params.customer.email,
      phone: params.customer.phone,
    },
    appointment: {
      id: params.appointment.id,
      startsAt: params.appointment.startsAt.toISOString(),
      endsAt: params.appointment.endsAt.toISOString(),
      status: params.appointment.status,
      services,
      serviceName: services.join(", ") || "Appointment",
      date: formatEmailDate(params.appointment.startsAt, salon.timezone),
      time: formatEmailTime(params.appointment.startsAt, salon.timezone),
      staffName: params.staffName ?? "",
      priceTotalCents: params.appointment.priceTotalCents,
      notes: params.appointment.customerNote,
    },
  };
}

export const emailService = {
  /** Sent when an appointment becomes confirmed (auto-confirm or staff decision). */
  sendBookingConfirmation(ctx: AppointmentEmailContext): Promise<void> {
    return triggerWebhook({ event: "booking_confirmation", ...ctx });
  },

  /** Sent by the reminder cron job ahead of an upcoming confirmed appointment. */
  sendAppointmentReminder(ctx: AppointmentEmailContext): Promise<void> {
    return triggerWebhook({ event: "appointment_reminder", ...ctx });
  },

  /** Sent when a confirmed appointment is cancelled. */
  sendCancellationEmail(
    ctx: AppointmentEmailContext,
    reason?: string | null
  ): Promise<void> {
    return triggerWebhook({
      event: "cancellation",
      ...ctx,
      meta: reason ? { reason } : undefined,
    });
  },

  /**
   * Sent when an appointment is moved to a new time. `ctx.appointment.date`
   * / `.time` already reflect the NEW time (matching the `newDate || date`
   * fallback pattern most reschedule templates use) — the previous time is
   * included in `meta` for templates that want to show a "moved from" line.
   */
  sendRescheduleEmail(
    ctx: AppointmentEmailContext,
    previousStartsAt: Date
  ): Promise<void> {
    return triggerWebhook({
      event: "reschedule",
      ...ctx,
      meta: {
        previousStartsAt: previousStartsAt.toISOString(),
        previousDate: formatEmailDate(previousStartsAt, ctx.salon.timezone),
        previousTime: formatEmailTime(previousStartsAt, ctx.salon.timezone),
      },
    });
  },

  // Add new email types here as the app grows — one method, one event name,
  // zero changes needed anywhere else (n8n owns the template + Resend call).
};
