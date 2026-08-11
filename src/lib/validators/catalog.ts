import { z } from "zod";
import { zIsoDate, zTime, zUuid } from "./booking";

export const serviceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  priceCents: z.coerce.number().int().min(0).max(10_000_000).default(0),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(240).default(0),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(240).default(0),
  color: z.string().trim().max(20).optional().nullable(),
  isPublic: z.boolean().default(true),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const staffSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  roleTitle: z.string().trim().max(100).optional().nullable(),
  color: z.string().trim().max(20).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const customerPatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().max(320).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  isVip: z.boolean().optional(),
  notes: z.string().trim().max(5000).optional().nullable(),
});

const weeklyWindow = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  opensAt: zTime,
  closesAt: zTime,
});

export const businessHoursSchema = z.object({
  windows: z
    .array(weeklyWindow)
    .max(21)
    .refine(
      (ws) => ws.every((w) => w.opensAt < w.closesAt),
      "Opening time must be before closing time"
    ),
});

export const staffHoursSchema = z.object({
  staffId: zUuid,
  windows: z
    .array(
      z.object({
        weekday: z.coerce.number().int().min(0).max(6),
        startsAt: zTime,
        endsAt: zTime,
      })
    )
    .max(21)
    .refine(
      (ws) => ws.every((w) => w.startsAt < w.endsAt),
      "Start time must be before end time"
    ),
});

export const blockedTimeSchema = z.object({
  staffId: zUuid.optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  reason: z.string().trim().max(300).optional().nullable(),
});

const MAX_PROMO_DAYS = 31;

/** Days between two "YYYY-MM-DD" strings (positive when `to` is later). */
function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export const promoSchema = z
  .object({
    label: z.string().trim().max(100).optional().nullable(),
    type: z.enum(["percent", "fixed"]),
    // percent: 1-100. fixed: a price in cents, validated against the
    // service's current price in the service layer (needs the row).
    value: z.coerce.number().int().min(1),
    // Local calendar dates ("YYYY-MM-DD") — converted to the salon's
    // timezone-aware start/end-of-day instants in the service layer, same
    // as holiday closures.
    startsAt: zIsoDate,
    endsAt: zIsoDate,
  })
  .refine((d) => daysBetween(d.startsAt, d.endsAt) >= 0, {
    message: "End date must be on or after the start date.",
    path: ["endsAt"],
  })
  .refine((d) => daysBetween(d.startsAt, d.endsAt) <= MAX_PROMO_DAYS, {
    message: "Promotions can run for at most a month.",
    path: ["endsAt"],
  })
  .refine((d) => d.type !== "percent" || d.value <= 100, {
    message: "Percent-off must be between 1 and 100.",
    path: ["value"],
  });
