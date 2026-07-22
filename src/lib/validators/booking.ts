import { z } from "zod";

/** Shared primitives */
export const zUuid = z.string().uuid();
export const zIsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export const zTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM (24h)");
export const zInstant = z.coerce.date();

/** POST /api/appointments — staff-created booking */
export const createAppointmentSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(320).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
  }),
  serviceIds: z.array(zUuid).max(10).default([]),
  staffId: zUuid.optional().nullable(),
  startsAt: zInstant,
  customerNote: z.string().trim().max(2000).optional().nullable(),
  internalNote: z.string().trim().max(2000).optional().nullable(),
  allowConflicts: z.boolean().optional(),
});

/** PATCH /api/appointments/[id] */
export const updateAppointmentSchema = z
  .object({
    action: z.enum([
      "confirm",
      "decline",
      "cancel",
      "reschedule",
      "complete",
      "no_show",
      "edit",
    ]),
    // reschedule
    startsAt: zInstant.optional(),
    staffId: zUuid.optional().nullable(),
    allowConflicts: z.boolean().optional(),
    // cancel
    reason: z.string().trim().max(500).optional().nullable(),
    // edit
    internalNote: z.string().trim().max(2000).optional().nullable(),
  })
  .refine(
    (v) => v.action !== "reschedule" || v.startsAt !== undefined,
    { message: "reschedule requires startsAt", path: ["startsAt"] }
  );

/** GET /api/appointments query params */
export const listAppointmentsSchema = z.object({
  status: z
    .enum(["pending", "confirmed", "declined", "cancelled", "completed", "no_show"])
    .optional(),
  from: zInstant.optional(),
  to: zInstant.optional(),
  staffId: zUuid.optional(),
  customerId: zUuid.optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  order: z.enum(["asc", "desc"]).default("asc"),
});

/** POST /api/public/bookings — n8n / Tally webhook (API-key authenticated) */
export const publicBookingSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(320).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
  }),
  serviceIds: z.array(zUuid).max(10).default([]),
  /** Alternative to serviceIds for form-based callers */
  serviceName: z.string().trim().max(200).optional(),
  staffId: zUuid.optional().nullable(),
  /** Either a UTC instant… */
  startsAt: zInstant.optional(),
  /** …or salon-local date + time (converted using the salon's timezone) */
  date: zIsoDate.optional(),
  time: zTime.optional(),
  note: z.string().trim().max(2000).optional().nullable(),
  /** Idempotency key, e.g. Tally submission id */
  externalRef: z.string().trim().max(200).optional().nullable(),
});

/** GET /api/public/availability query */
export const availabilityQuerySchema = z.object({
  salon: z.string().trim().min(1).max(64), // slug
  date: zIsoDate,
  days: z.coerce.number().int().min(1).max(31).default(1),
  serviceIds: z
    .union([z.array(zUuid), z.string().transform((s) => s.split(",").filter(Boolean))])
    .pipe(z.array(zUuid).max(10)),
  staffId: zUuid.optional(),
  /** Let the customer choose how tightly slots are packed on the booking page */
  granularityMinutes: z.coerce
    .number()
    .int()
    .optional()
    .refine((v) => v === undefined || v === 15 || v === 30, {
      message: "granularityMinutes must be 15 or 30",
    }),
});
