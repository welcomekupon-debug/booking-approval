import type { Booking } from "@/types/booking";
import { DAY_KEYS, type DayHours } from "@/types/app";
import {
  addDays,
  bookingDateTime,
  parseBookingDate,
  startOfDay,
  startOfWeek,
} from "@/lib/dates";

export function normStatus(b: Booking): string {
  return b.Status?.toString().trim().toLowerCase() ?? "";
}

export interface TrendStat {
  value: number;
  previous: number;
  /** % change vs previous period; null when previous is 0 */
  delta: number | null;
}

export interface DashboardStats {
  todayCount: number;
  upcoming: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  revenue: TrendStat; // this month vs last month
  newCustomers: TrendStat; // this month vs last month
  repeatCustomers: number;
  occupancyRate: number; // % of upcoming 7 days with at least one booking
  weekBookings: TrendStat; // this week vs last week
  monthBookings: TrendStat; // this month vs last month
}

function pctDelta(value: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((value - previous) / previous) * 100);
}

/** Sum of Price for confirmed bookings within [from, to) */
function revenueBetween(bookings: Booking[], from: Date, to: Date): number {
  let sum = 0;
  for (const b of bookings) {
    if (normStatus(b) !== "confirmed") continue;
    const d = parseBookingDate(b.Datum);
    if (!d || d < from || d >= to) continue;
    const price = parseFloat(String(b.Price).replace(",", "."));
    if (!isNaN(price)) sum += price;
  }
  return Math.round(sum * 100) / 100;
}

function firstBookingMonth(bookings: Booking[]): Map<string, Date> {
  const first = new Map<string, Date>();
  for (const b of bookings) {
    const email = b.Gmail?.trim().toLowerCase();
    if (!email) continue;
    const d = parseBookingDate(b.Datum);
    if (!d) continue;
    const existing = first.get(email);
    if (!existing || d < existing) first.set(email, d);
  }
  return first;
}

export function computeDashboardStats(bookings: Booking[]): DashboardStats {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);

  const weekStart = startOfWeek(now);
  const lastWeekStart = addDays(weekStart, -7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let todayCount = 0;
  let upcoming = 0;
  let confirmed = 0;
  let pending = 0;
  let cancelled = 0;
  let weekCount = 0;
  let lastWeekCount = 0;
  let monthCount = 0;
  let lastMonthCount = 0;

  for (const b of bookings) {
    const status = normStatus(b);
    if (status === "pending") pending++;
    else if (status === "confirmed") confirmed++;
    else if (status === "declined" || status === "cancelled") cancelled++;

    const d = parseBookingDate(b.Datum);
    if (!d) continue;

    if (d >= today && d < tomorrow) todayCount++;
    if (d >= tomorrow && status !== "declined" && status !== "cancelled") upcoming++;

    if (d >= weekStart && d < addDays(weekStart, 7)) weekCount++;
    if (d >= lastWeekStart && d < weekStart) lastWeekCount++;
    if (d >= monthStart && d < nextMonthStart) monthCount++;
    if (d >= lastMonthStart && d < monthStart) lastMonthCount++;
  }

  // New / repeat customers
  const firstSeen = firstBookingMonth(bookings);
  let newCustomers = 0;
  let newCustomersLastMonth = 0;
  for (const d of Array.from(firstSeen.values())) {
    if (d >= monthStart && d < nextMonthStart) newCustomers++;
    if (d >= lastMonthStart && d < monthStart) newCustomersLastMonth++;
  }

  const bookingsPerCustomer = new Map<string, number>();
  for (const b of bookings) {
    const email = b.Gmail?.trim().toLowerCase();
    if (!email) continue;
    bookingsPerCustomer.set(email, (bookingsPerCustomer.get(email) ?? 0) + 1);
  }
  let repeatCustomers = 0;
  for (const count of Array.from(bookingsPerCustomer.values())) {
    if (count > 1) repeatCustomers++;
  }

  // Occupancy: share of the next 7 days that have at least one non-declined booking
  let occupiedDays = 0;
  for (let i = 0; i < 7; i++) {
    const dayStart = addDays(today, i);
    const dayEnd = addDays(dayStart, 1);
    const has = bookings.some((b) => {
      const s = normStatus(b);
      if (s === "declined" || s === "cancelled") return false;
      const d = parseBookingDate(b.Datum);
      return d !== null && d >= dayStart && d < dayEnd;
    });
    if (has) occupiedDays++;
  }
  const occupancyRate = Math.round((occupiedDays / 7) * 100);

  const revenue = revenueBetween(bookings, monthStart, nextMonthStart);
  const revenuePrev = revenueBetween(bookings, lastMonthStart, monthStart);

  return {
    todayCount,
    upcoming,
    confirmed,
    pending,
    cancelled,
    revenue: { value: revenue, previous: revenuePrev, delta: pctDelta(revenue, revenuePrev) },
    newCustomers: {
      value: newCustomers,
      previous: newCustomersLastMonth,
      delta: pctDelta(newCustomers, newCustomersLastMonth),
    },
    repeatCustomers,
    occupancyRate,
    weekBookings: {
      value: weekCount,
      previous: lastWeekCount,
      delta: pctDelta(weekCount, lastWeekCount),
    },
    monthBookings: {
      value: monthCount,
      previous: lastMonthCount,
      delta: pctDelta(monthCount, lastMonthCount),
    },
  };
}

// ── Chart data helpers ──────────────────────────────────────────────────────

export interface SeriesPoint {
  label: string;
  value: number;
}

/** Bookings per day for the last `days` days (inclusive of today). */
export function bookingsPerDay(bookings: Booking[], days = 30): SeriesPoint[] {
  const today = startOfDay(new Date());
  const points: SeriesPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = addDays(today, -i);
    const dayEnd = addDays(dayStart, 1);
    const count = bookings.filter((b) => {
      const d = parseBookingDate(b.Datum);
      return d !== null && d >= dayStart && d < dayEnd;
    }).length;
    points.push({
      label: dayStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      value: count,
    });
  }
  return points;
}

/** Bookings per month for the last `months` months. */
export function bookingsPerMonth(bookings: Booking[], months = 6): SeriesPoint[] {
  const now = new Date();
  const points: SeriesPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const count = bookings.filter((b) => {
      const d = parseBookingDate(b.Datum);
      return d !== null && d >= from && d < to;
    }).length;
    points.push({
      label: from.toLocaleDateString("en-GB", { month: "short" }),
      value: count,
    });
  }
  return points;
}

/** Revenue per month (confirmed only) for the last `months` months. */
export function revenuePerMonth(bookings: Booking[], months = 6): SeriesPoint[] {
  const now = new Date();
  const points: SeriesPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    points.push({
      label: from.toLocaleDateString("en-GB", { month: "short" }),
      value: revenueBetween(bookings, from, to),
    });
  }
  return points;
}

export interface HourRange {
  start: number; // 0-23
  end: number; // 0-23, inclusive
}

/**
 * Earliest opening / latest closing hour across the days the salon is open,
 * rounded down/up to the hour. Falls back to 7–20 when no day is marked open
 * (e.g. hours not set up yet) so the dashboard never renders an empty chart.
 */
export function businessHourRange(hours: Record<string, DayHours>): HourRange {
  let start = 24;
  let end = 0;
  for (const key of DAY_KEYS) {
    const day = hours[key];
    if (!day?.open) continue;
    const from = parseInt(day.from?.slice(0, 2) ?? "", 10);
    const to = parseInt(day.to?.slice(0, 2) ?? "", 10);
    if (!Number.isNaN(from)) start = Math.min(start, from);
    if (!Number.isNaN(to)) end = Math.max(end, to);
  }
  if (start > end) return { start: 7, end: 20 };
  return { start, end };
}

/** Booking counts by hour of day, non-declined only. */
export function bookingsByHour(
  bookings: Booking[],
  range: HourRange = { start: 7, end: 20 }
): SeriesPoint[] {
  const counts = new Array(24).fill(0);
  for (const b of bookings) {
    const s = normStatus(b);
    if (s === "declined" || s === "cancelled") continue;
    const dt = bookingDateTime(b.Datum, b.Ura);
    if (dt) counts[dt.getHours()]++;
  }
  const start = Math.max(0, Math.min(23, range.start));
  const end = Math.max(start, Math.min(23, range.end));
  const points: SeriesPoint[] = [];
  for (let h = start; h <= end; h++) {
    points.push({ label: `${h}:00`, value: counts[h] });
  }
  return points;
}

/** Count per service (non-declined), sorted desc. */
export function bookingsByService(bookings: Booking[]): SeriesPoint[] {
  const counts = new Map<string, number>();
  for (const b of bookings) {
    const s = normStatus(b);
    if (s === "declined" || s === "cancelled") continue;
    const service = b.Service?.trim() || "Unspecified";
    counts.set(service, (counts.get(service) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/** Count per staff member (non-declined), sorted desc. */
export function bookingsByStaff(bookings: Booking[]): SeriesPoint[] {
  const counts = new Map<string, number>();
  for (const b of bookings) {
    const s = normStatus(b);
    if (s === "declined" || s === "cancelled") continue;
    const staff = b.Staff?.trim() || "Unassigned";
    counts.set(staff, (counts.get(staff) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/** % of customers with more than one booking. */
export function retentionRate(bookings: Booking[]): number {
  const counts = new Map<string, number>();
  for (const b of bookings) {
    const email = b.Gmail?.trim().toLowerCase();
    if (!email) continue;
    counts.set(email, (counts.get(email) ?? 0) + 1);
  }
  if (counts.size === 0) return 0;
  let repeat = 0;
  for (const c of Array.from(counts.values())) {
    if (c > 1) repeat++;
  }
  return Math.round((repeat / counts.size) * 100);
}
