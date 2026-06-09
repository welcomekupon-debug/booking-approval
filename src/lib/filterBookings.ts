import type { Booking, StatusFilter, DateFilter } from "@/types/booking";
import { parseBookingDate, startOfWeek } from "@/lib/dates";

/**
 * Apply search, status, and date filters to a list of bookings.
 * All comparisons are case-insensitive. Invalid / missing dates are excluded
 * when a date filter (other than "all") is active.
 *
 * This is a pure function — safe to wrap in useMemo on the client.
 */
export function filterBookings(
  bookings: Booking[],
  query: string,
  statusFilter: StatusFilter,
  dateFilter: DateFilter
): Booking[] {
  const q = query.trim().toLowerCase();
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();
  const weekStart = startOfWeek(now);

  return bookings.filter((booking) => {
    // ── Search (Ime + Gmail) ──────────────────────────────────────────────
    if (q) {
      const nameMatch = booking.Ime?.toLowerCase().includes(q);
      const emailMatch = booking.Gmail?.toLowerCase().includes(q);
      if (!nameMatch && !emailMatch) return false;
    }

    // ── Status filter ─────────────────────────────────────────────────────
    if (statusFilter !== "all") {
      const s = booking.Status?.toString().trim().toLowerCase();
      if (s !== statusFilter) return false;
    }

    // ── Date filter ───────────────────────────────────────────────────────
    if (dateFilter !== "all") {
      const d = parseBookingDate(booking.Datum);
      if (!d) return false; // unparseable date excluded when filter is active

      if (dateFilter === "today") {
        if (
          d.getFullYear() !== todayY ||
          d.getMonth() !== todayM ||
          d.getDate() !== todayD
        )
          return false;
      } else if (dateFilter === "week") {
        // booking date must be >= Monday of current week and <= today
        if (d < weekStart || d > now) return false;
      } else if (dateFilter === "month") {
        if (d.getFullYear() !== todayY || d.getMonth() !== todayM)
          return false;
      }
    }

    return true;
  });
}
