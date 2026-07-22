import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, salons } from "@/lib/db/schema";
import { getServicesByIds, listStaff } from "@/lib/repositories/catalog";
import {
  listBlockedTimes,
  listBusinessHours,
  listStaffWorkingHours,
} from "@/lib/repositories/hours";
import { getSettings } from "@/lib/repositories/settings";
import { ApiError } from "@/lib/errors";
import {
  addDaysIso,
  localDateTimeToUtc,
  todayLocalIso,
  weekdayOfLocalDate,
} from "./timezone";

/**
 * Availability engine.
 *
 * free(day, staff) =
 *     businessHours(weekday)
 *   ∩ staffWorkingHours(staff, weekday)      (when a staff member is chosen)
 *   − blockedTimes(salon-wide and staff)
 *   − existing appointments (pending+confirmed, inflated by their buffers)
 *
 * Candidate slots are generated on the settings' granularity grid; a slot is
 * offered when [start − bufferBefore, start + duration + bufferAfter] fits
 * entirely inside a free interval, respecting min-notice and max-advance.
 *
 * All interval math happens in UTC milliseconds; wall-clock windows are
 * converted per-day via the timezone helpers (DST-safe).
 */

interface Interval {
  start: number; // UTC ms
  end: number;
}

export interface SlotQuery {
  salonId: string;
  /** Salon-local "YYYY-MM-DD" */
  date: string;
  serviceIds: string[];
  staffId?: string;
}

export interface Slot {
  /** UTC instants — render local with the salon's timezone */
  startsAt: Date;
  endsAt: Date;
  /** Staff member who can take it (set when query had no staff preference) */
  staffId: string | null;
}

// ── Interval algebra ────────────────────────────────────────────────────────

function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const x of a) {
    for (const y of b) {
      const start = Math.max(x.start, y.start);
      const end = Math.min(x.end, y.end);
      if (start < end) out.push({ start, end });
    }
  }
  return out;
}

function subtract(from: Interval[], remove: Interval[]): Interval[] {
  let current = [...from];
  for (const r of remove) {
    const next: Interval[] = [];
    for (const interval of current) {
      if (r.end <= interval.start || r.start >= interval.end) {
        next.push(interval); // no overlap
        continue;
      }
      if (r.start > interval.start) {
        next.push({ start: interval.start, end: r.start });
      }
      if (r.end < interval.end) {
        next.push({ start: r.end, end: interval.end });
      }
    }
    current = next;
  }
  return current;
}

// ── Engine ──────────────────────────────────────────────────────────────────

export async function getAvailableSlots(query: SlotQuery): Promise<Slot[]> {
  const salon = await db.query.salons.findFirst({
    where: eq(salons.id, query.salonId),
  });
  if (!salon) throw ApiError.notFound("Salon not found.");

  const [settings, services] = await Promise.all([
    getSettings(query.salonId),
    getServicesByIds(query.salonId, query.serviceIds),
  ]);

  if (services.length !== query.serviceIds.length) {
    throw ApiError.badRequest("One or more services do not exist.");
  }

  const durationMinutes =
    services.reduce((sum, s) => sum + s.durationMinutes, 0) ||
    settings.defaultDurationMinutes;
  const bufferBefore = Math.max(
    settings.defaultBufferBeforeMinutes,
    ...services.map((s) => s.bufferBeforeMinutes)
  );
  const bufferAfter = Math.max(
    settings.defaultBufferAfterMinutes,
    ...services.map((s) => s.bufferAfterMinutes)
  );

  // ── Guard rails: max advance / past dates ─────────────────────────────────
  const todayIso = todayLocalIso(salon.timezone);
  if (query.date < todayIso) return [];
  if (query.date > addDaysIso(todayIso, settings.maxAdvanceDays)) return [];

  const weekday = weekdayOfLocalDate(query.date);
  const toUtcMs = (time: string) =>
    localDateTimeToUtc(query.date, time, salon.timezone).getTime();

  // ── Salon opening windows for that weekday ────────────────────────────────
  const allBusinessHours = await listBusinessHours(query.salonId);
  const salonWindows: Interval[] = allBusinessHours
    .filter((h) => h.weekday === weekday)
    .map((h) => ({ start: toUtcMs(h.opensAt), end: toUtcMs(h.closesAt) }));

  if (salonWindows.length === 0) return [];

  // ── Which staff members are we scheduling against? ────────────────────────
  const staffPool = query.staffId
    ? [query.staffId]
    : (await listStaff(query.salonId)).map((s) => s.id);
  // No staff configured at all → schedule against the salon as a whole
  const pools: (string | null)[] = staffPool.length > 0 ? staffPool : [null];

  // ── Shared inputs for the whole day ───────────────────────────────────────
  const dayStart = localDateTimeToUtc(query.date, "00:00", salon.timezone);
  const dayEnd = localDateTimeToUtc(
    addDaysIso(query.date, 1),
    "00:00",
    salon.timezone
  );

  const [allStaffHours, blocked, dayAppointments] = await Promise.all([
    listStaffWorkingHours(query.salonId),
    listBlockedTimes(query.salonId, { from: dayStart, to: dayEnd }),
    db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, query.salonId),
          inArray(appointments.status, ["pending", "confirmed"])
        )
      )
      .then((rows) =>
        rows.filter(
          (a) =>
            a.startsAt.getTime() < dayEnd.getTime() + 24 * 3600_000 &&
            a.endsAt.getTime() > dayStart.getTime() - 24 * 3600_000
        )
      ),
  ]);

  const durationMs = durationMinutes * 60_000;
  const bufferBeforeMs = bufferBefore * 60_000;
  const bufferAfterMs = bufferAfter * 60_000;
  const minStartMs = Date.now() + settings.minNoticeMinutes * 60_000;

  // Slot spacing follows the selected service's own duration — a 45-minute
  // service is offered every 45 minutes, not on a disconnected fixed grid —
  // so bookings pack back-to-back with zero wasted calendar time. The
  // salon's chosen grid (Settings → Booking preferences) still acts as a
  // floor, so very short services don't flood the list with options closer
  // together than the owner wants.
  const gridMs = settings.slotGranularityMinutes * 60_000;
  const stepMs = Math.max(durationMs, gridMs);

  const slots: Slot[] = [];
  const seenStarts = new Set<number>();

  for (const staffId of pools) {
    // Staff hours ∩ salon hours (staff with no configured hours inherit salon hours)
    let windows = salonWindows;
    if (staffId) {
      const staffWindows: Interval[] = allStaffHours
        .filter((h) => h.staffId === staffId && h.weekday === weekday)
        .map((h) => ({ start: toUtcMs(h.startsAt), end: toUtcMs(h.endsAt) }));
      const hasAnyHours = allStaffHours.some((h) => h.staffId === staffId);
      windows = hasAnyHours ? intersect(salonWindows, staffWindows) : salonWindows;
    }

    // Remove blocked times (salon-wide + this staff member's)
    const applicableBlocks: Interval[] = blocked
      .filter((b) => b.staffId === null || b.staffId === staffId)
      .map((b) => ({ start: b.startsAt.getTime(), end: b.endsAt.getTime() }));

    // Remove busy appointments, inflated by their own buffers
    const busy: Interval[] = dayAppointments
      .filter((a) => (staffId ? a.staffId === staffId || a.staffId === null : true))
      .map((a) => ({
        start: a.startsAt.getTime() - a.bufferBeforeMinutes * 60_000,
        end: a.endsAt.getTime() + a.bufferAfterMinutes * 60_000,
      }));

    const free = subtract(subtract(windows, applicableBlocks), busy);

    // Generate candidates on the granularity grid
    for (const interval of free) {
      const firstGrid = Math.ceil(interval.start / stepMs) * stepMs;
      for (let start = firstGrid; start < interval.end; start += stepMs) {
        const blockStart = start - bufferBeforeMs;
        const blockEnd = start + durationMs + bufferAfterMs;
        if (blockStart < interval.start || blockEnd > interval.end) continue;
        if (start < minStartMs) continue;
        if (seenStarts.has(start)) continue; // same time from another staff

        seenStarts.add(start);
        slots.push({
          startsAt: new Date(start),
          endsAt: new Date(start + durationMs),
          staffId,
        });
      }
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Multi-day convenience wrapper for the public booking page. */
export async function getAvailableSlotsForRange(
  query: Omit<SlotQuery, "date"> & { fromDate: string; days: number }
): Promise<Record<string, Slot[]>> {
  const days = Math.min(query.days, 31);
  const result: Record<string, Slot[]> = {};

  // Sequential to bound DB load; each day reuses warm connections
  for (let i = 0; i < days; i++) {
    const date = addDaysIso(query.fromDate, i);
    result[date] = await getAvailableSlots({ ...query, date });
  }
  return result;
}
