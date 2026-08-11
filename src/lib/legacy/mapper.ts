import type {
  AppointmentDetail,
  BlockedTime,
  BusinessHour,
  Customer as DbCustomer,
  Salon,
  Service as DbService,
  Settings as DbSettings,
  StaffMember as DbStaff,
} from "@/lib/db/types";
import type { Booking } from "@/types/booking";
import type {
  BusinessSettings,
  CustomerMeta,
  DayHours,
  Service,
  ServicePromo,
  StaffMember,
} from "@/types/app";
import { DAY_KEYS, DEFAULT_SETTINGS } from "@/types/app";
import { utcToWall } from "@/lib/services/timezone";
import {
  effectivePriceCents,
  isPromoActive,
  isPromoScheduled,
} from "@/lib/services/pricing";

/**
 * Legacy mapper — translates between Postgres rows and the sheet-era view
 * models the UI still consumes. This file is the migration seam: when Phase 5
 * moves the UI onto the DB shapes, this file is deleted.
 */

// ── Formatting helpers ──────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

export function toLegacyDate(instant: Date, timezone: string): string {
  const w = utcToWall(instant, timezone);
  return `${pad(w.day)}.${pad(w.month)}.${w.year}`;
}

export function toLegacyTime(instant: Date, timezone: string): string {
  const w = utcToWall(instant, timezone);
  return `${pad(w.hour)}:${pad(w.minute)}`;
}

/** "DD.MM.YYYY" or "YYYY-MM-DD" → "YYYY-MM-DD" (null when unparseable) */
export function legacyDateToIso(raw: string): string | null {
  const s = raw?.trim();
  if (!s) return null;
  const euro = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (euro) return `${euro[3]}-${pad(+euro[2])}-${pad(+euro[1])}`;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${pad(+iso[2])}-${pad(+iso[3])}`;
  return null;
}

export function centsToDecimal(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

export function decimalToCents(raw: string | undefined): number | null {
  if (raw === undefined || raw === null || raw.trim() === "") return null;
  const n = parseFloat(raw.replace(",", "."));
  return isNaN(n) ? null : Math.round(n * 100);
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No-show",
};

// ── DB → legacy view models ─────────────────────────────────────────────────

export function mapAppointment(
  a: AppointmentDetail,
  timezone: string
): Booking {
  const durationMinutes = Math.round(
    (a.endsAt.getTime() - a.startsAt.getTime()) / 60_000
  );

  return {
    id: a.id,
    Ime: a.customer.name,
    Gmail: a.customer.email ?? "",
    Datum: toLegacyDate(a.startsAt, timezone),
    Ura: toLegacyTime(a.startsAt, timezone),
    Status: STATUS_LABELS[a.status] ?? a.status,
    Bookingid: a.externalRef ?? a.id.slice(0, 8),
    UpdatedAt: a.updatedAt.toISOString(),
    Phone: a.customer.phone ?? "",
    Service: a.services.map((s) => s.serviceName).join(", "),
    ServiceId: a.services[0]?.serviceId ?? "",
    Duration: durationMinutes ? String(durationMinutes) : "",
    Notes: a.internalNote ?? "",
    Price: centsToDecimal(a.priceTotalCents),
    Staff: a.staff?.name ?? "",
    StaffId: a.staffId ?? "",
  };
}

/** UTC instant → local "YYYY-MM-DD" in the given timezone. */
function toIsoDateInTz(instant: Date, timezone: string): string {
  const w = utcToWall(instant, timezone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

export function mapService(s: DbService, timezone: string): Service {
  const hasPromo = !!(
    s.promoType &&
    s.promoValue != null &&
    s.promoStartsAt &&
    s.promoEndsAt
  );

  return {
    id: s.id,
    name: s.name,
    duration: String(s.durationMinutes),
    price: centsToDecimal(s.priceCents),
    color: s.color ?? "",
    active: s.isActive,
    promo: hasPromo
      ? {
          label: s.promoLabel ?? "",
          type: s.promoType!,
          percentOff: s.promoType === "percent" ? s.promoValue! : undefined,
          fixedPrice:
            s.promoType === "fixed" ? centsToDecimal(s.promoValue!) : undefined,
          startsAt: toIsoDateInTz(s.promoStartsAt!, timezone),
          endsAt: toIsoDateInTz(s.promoEndsAt!, timezone),
          active: isPromoActive(s),
          scheduled: isPromoScheduled(s),
          effectivePrice: centsToDecimal(effectivePriceCents(s)),
        }
      : null,
  };
}

export function mapStaff(s: DbStaff): StaffMember {
  return {
    id: s.id,
    name: s.name,
    email: s.email ?? "",
    phone: s.phone ?? "",
    role: s.roleTitle ?? "",
    color: s.color ?? "",
    active: s.isActive,
  };
}

export function mapCustomerMeta(c: DbCustomer): CustomerMeta {
  return {
    email: c.email ?? "",
    phone: c.phone ?? "",
    tags: c.tags,
    vip: c.isVip,
    notes: c.notes ?? "",
  };
}

const HOLIDAY_REASON = "Holiday";

export function mapSettings(
  salon: Salon,
  s: DbSettings,
  hours: BusinessHour[],
  blocks: BlockedTime[]
): BusinessSettings {
  const hoursMap: Record<string, DayHours> = {};
  for (let weekday = 0; weekday < 7; weekday++) {
    const windows = hours.filter((h) => h.weekday === weekday);
    const key = DAY_KEYS[weekday];
    if (windows.length === 0) {
      hoursMap[key] = { ...DEFAULT_SETTINGS.hours[key], open: false };
    } else {
      // Legacy UI shows one window per day — use the earliest/latest
      hoursMap[key] = {
        open: true,
        from: windows[0].opensAt.slice(0, 5),
        to: windows[windows.length - 1].closesAt.slice(0, 5),
      };
    }
  }

  const holidays = blocks
    .filter(
      (b) => b.staffId === null && (b.reason === HOLIDAY_REASON || b.isPublicHoliday)
    )
    .map((b) => ({
      date: b.startsAt.toISOString().slice(0, 10),
      name: b.isPublicHoliday ? (b.reason ?? undefined) : undefined,
      official: b.isPublicHoliday,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    businessName: salon.name,
    businessType: salon.businessType ?? "",
    businessCategory: salon.category,
    country: salon.country ?? "",
    address: salon.address ?? "",
    phone: salon.phone ?? "",
    email: salon.email ?? "",
    website: salon.website ?? "",
    googleReviewUrl: salon.googleReviewUrl ?? "",
    logoUrl: salon.logoUrl ?? "",
    brandColor: salon.brandColor ?? "#B99A55",
    currency: salon.currency,
    timezone: salon.timezone,
    hours: hoursMap,
    holidays,
    defaultDuration: s.defaultDurationMinutes,
    bufferMinutes: s.defaultBufferAfterMinutes,
    slotGranularityMinutes: s.slotGranularityMinutes,
    maxAdvanceDays: s.maxAdvanceDays,
    autoConfirm: s.autoConfirm,
    allowCancellation: s.allowCancellation,
    revenueEnabled: s.revenueEnabled,
    notifyEmailNewRequest: s.notifyEmailNewRequest,
    notifyEmailConfirmation: s.notifyEmailConfirmation,
    notifyEmailCancellation: s.notifyEmailCancellation,
    notifyEmailDailySummary: s.notifyEmailDailySummary,
    notifyEmailReminder: s.notifyEmailReminder,
    notifySmsReminder: s.notifySmsReminder,
    notifySmsConfirmation: s.notifySmsConfirmation,
    reminderHoursBefore: s.reminderHoursBefore,
    onboardingComplete: s.onboardingComplete,
  };
}

export { HOLIDAY_REASON };
