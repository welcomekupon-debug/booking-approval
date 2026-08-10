import { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/api";
import { getTenantContext, requireRole } from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import { createSalonForUser, updateSalon } from "@/lib/repositories/salons";
import {
  createBlockedTime,
  deleteBlockedTime,
  listBlockedTimes,
  replaceBusinessHours,
} from "@/lib/repositories/hours";
import { updateSettings } from "@/lib/repositories/settings";
import { HOLIDAY_REASON } from "@/lib/legacy/mapper";
import { localDateTimeToUtc } from "@/lib/services/timezone";
import { DAY_KEYS } from "@/types/app";
import { BUSINESS_CATEGORIES } from "@/lib/roleLabels";

const dayHours = z.strictObject({
  open: z.boolean(),
  from: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  to: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const legacySettings = z
  .strictObject({
    businessName: z.string().trim().max(200).optional(),
    businessType: z.string().trim().max(100).optional(),
    businessCategory: z
      .enum(BUSINESS_CATEGORIES as unknown as [string, ...string[]])
      .optional(),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/)
      .optional()
      .or(z.literal("")),
    address: z.string().trim().max(500).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().max(320).optional(),
    website: z.string().trim().max(300).optional(),
    logoUrl: z.string().trim().max(1000).optional(),
    brandColor: z.string().trim().max(20).optional(),
    currency: z.string().trim().length(3).optional(),
    timezone: z.string().trim().max(64).optional(),
    hours: z.record(z.string(), dayHours).optional(),
    holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    defaultDuration: z.coerce.number().int().min(5).max(600).optional(),
    bufferMinutes: z.coerce.number().int().min(0).max(240).optional(),
    slotGranularityMinutes: z.coerce.number().int().min(5).max(120).optional(),
    maxAdvanceDays: z.coerce.number().int().min(1).max(365).optional(),
    autoConfirm: z.boolean().optional(),
    allowCancellation: z.boolean().optional(),
    revenueEnabled: z.boolean().optional(),
    notifyEmailNewRequest: z.boolean().optional(),
    notifyEmailConfirmation: z.boolean().optional(),
    notifyEmailCancellation: z.boolean().optional(),
    notifyEmailDailySummary: z.boolean().optional(),
    notifyEmailReminder: z.boolean().optional(),
    notifySmsReminder: z.boolean().optional(),
    notifySmsConfirmation: z.boolean().optional(),
    reminderHoursBefore: z.coerce.number().int().min(1).max(168).optional(),
    onboardingComplete: z.boolean().optional(),
  });

/**
 * Legacy settings PUT, translated onto salons + settings + business_hours +
 * holiday blocked_times. On a brand-new account (no membership) this CREATES
 * the salon — that's how onboarding provisions the tenant.
 */
export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    const body = legacySettings.parse(await request.json());
    let { user, ctx } = await getTenantContext();

    if (!ctx) {
      if (!body.businessName?.trim()) {
        throw ApiError.badRequest(
          "A business name is required to create your salon."
        );
      }
      await createSalonForUser(user.id, {
        name: body.businessName.trim(),
        currency: body.currency,
      });
      ({ ctx } = await getTenantContext());
      if (!ctx) throw new Error("Salon creation failed.");
    } else {
      requireRole(ctx, "manager");
    }

    const salonId = ctx.salon.id;
    const tz = ctx.salon.timezone;

    // ── Salon profile fields ─────────────────────────────────────────────
    await updateSalon(salonId, {
      ...(body.businessName !== undefined && { name: body.businessName }),
      ...(body.businessType !== undefined && { businessType: body.businessType }),
      ...(body.businessCategory !== undefined && {
        category: body.businessCategory as (typeof BUSINESS_CATEGORIES)[number],
      }),
      ...(body.country !== undefined && { country: body.country || null }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.website !== undefined && { website: body.website }),
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
      ...(body.brandColor !== undefined && { brandColor: body.brandColor }),
      ...(body.currency !== undefined && { currency: body.currency }),
      ...(body.timezone !== undefined && { timezone: body.timezone }),
    });

    // ── Typed settings ───────────────────────────────────────────────────
    await updateSettings(salonId, {
      ...(body.defaultDuration !== undefined && {
        defaultDurationMinutes: body.defaultDuration,
      }),
      ...(body.bufferMinutes !== undefined && {
        defaultBufferAfterMinutes: body.bufferMinutes,
      }),
      ...(body.slotGranularityMinutes !== undefined && {
        slotGranularityMinutes: body.slotGranularityMinutes,
      }),
      ...(body.maxAdvanceDays !== undefined && {
        maxAdvanceDays: body.maxAdvanceDays,
      }),
      ...(body.autoConfirm !== undefined && { autoConfirm: body.autoConfirm }),
      ...(body.allowCancellation !== undefined && {
        allowCancellation: body.allowCancellation,
      }),
      ...(body.revenueEnabled !== undefined && {
        revenueEnabled: body.revenueEnabled,
      }),
      ...(body.notifyEmailNewRequest !== undefined && {
        notifyEmailNewRequest: body.notifyEmailNewRequest,
      }),
      ...(body.notifyEmailConfirmation !== undefined && {
        notifyEmailConfirmation: body.notifyEmailConfirmation,
      }),
      ...(body.notifyEmailCancellation !== undefined && {
        notifyEmailCancellation: body.notifyEmailCancellation,
      }),
      ...(body.notifyEmailDailySummary !== undefined && {
        notifyEmailDailySummary: body.notifyEmailDailySummary,
      }),
      ...(body.notifyEmailReminder !== undefined && {
        notifyEmailReminder: body.notifyEmailReminder,
      }),
      ...(body.notifySmsReminder !== undefined && {
        notifySmsReminder: body.notifySmsReminder,
      }),
      ...(body.notifySmsConfirmation !== undefined && {
        notifySmsConfirmation: body.notifySmsConfirmation,
      }),
      ...(body.reminderHoursBefore !== undefined && {
        reminderHoursBefore: body.reminderHoursBefore,
      }),
      ...(body.onboardingComplete !== undefined && {
        onboardingComplete: body.onboardingComplete,
      }),
    });

    // ── Weekly hours ─────────────────────────────────────────────────────
    if (body.hours) {
      const windows: { weekday: number; opensAt: string; closesAt: string }[] =
        [];
      DAY_KEYS.forEach((key, weekday) => {
        const day = body.hours![key];
        if (day?.open && day.from < day.to) {
          windows.push({ weekday, opensAt: day.from, closesAt: day.to });
        }
      });
      await replaceBusinessHours(salonId, windows);
    }

    // ── Holidays → salon-wide all-day blocked times ──────────────────────
    if (body.holidays) {
      const existing = (await listBlockedTimes(salonId)).filter(
        (b) => b.staffId === null && b.reason === HOLIDAY_REASON
      );
      const existingDates = new Map(
        existing.map((b) => [b.startsAt.toISOString().slice(0, 10), b])
      );
      const wanted = new Set(body.holidays);

      for (const iso of Array.from(wanted)) {
        if (!existingDates.has(iso)) {
          await createBlockedTime({
            salonId,
            staffId: null,
            startsAt: localDateTimeToUtc(iso, "00:00", tz),
            endsAt: localDateTimeToUtc(iso, "23:59", tz),
            reason: HOLIDAY_REASON,
          });
        }
      }
      for (const [iso, block] of Array.from(existingDates.entries())) {
        if (!wanted.has(iso)) await deleteBlockedTime(salonId, block.id);
      }
    }

    return { success: true };
  });
}
