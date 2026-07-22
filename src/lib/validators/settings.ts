import { z } from "zod";

export const salonPatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  businessType: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email().max(320).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  website: z.string().trim().max(300).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  logoUrl: z.string().trim().url().max(1000).optional().nullable().or(z.literal("")),
  brandColor: z.string().trim().max(20).optional().nullable(),
  currency: z.string().trim().length(3).optional(),
  timezone: z.string().trim().max(64).optional(),
});

export const settingsPatchSchema = z.object({
  defaultDurationMinutes: z.coerce.number().int().min(5).max(600).optional(),
  defaultBufferBeforeMinutes: z.coerce.number().int().min(0).max(240).optional(),
  defaultBufferAfterMinutes: z.coerce.number().int().min(0).max(240).optional(),
  slotGranularityMinutes: z.coerce.number().int().min(5).max(120).optional(),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365).optional(),
  minNoticeMinutes: z.coerce.number().int().min(0).max(10_080).optional(),
  autoConfirm: z.boolean().optional(),
  allowCancellation: z.boolean().optional(),
  cancellationWindowHours: z.coerce.number().int().min(0).max(720).optional(),
  revenueEnabled: z.boolean().optional(),
  notifyEmailNewRequest: z.boolean().optional(),
  notifyEmailConfirmation: z.boolean().optional(),
  notifyEmailCancellation: z.boolean().optional(),
  notifyEmailDailySummary: z.boolean().optional(),
  notifySmsConfirmation: z.boolean().optional(),
  notifySmsReminder: z.boolean().optional(),
  reminderHoursBefore: z.coerce.number().int().min(1).max(168).optional(),
  onboardingComplete: z.boolean().optional(),
});

export const createSalonSchema = z.object({
  name: z.string().trim().min(1).max(200),
  timezone: z.string().trim().max(64).optional(),
  currency: z.string().trim().length(3).optional(),
});
