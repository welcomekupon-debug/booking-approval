import type { Booking, StatusFilter, DateFilter } from "@/types/booking";
import { parseBookingDate, startOfDay, startOfWeek, addDays } from "@/lib/dates";

/**
 * Apply search, status, and date filters to a list of bookings.
 * Search covers name, email, phone, service, staff, notes, and booking ID.
 */
export function filterBookings(
  bookings: Booking[],
  query: string,
  statusFilter: StatusFilter,
  dateFilter: DateFilter
): Booking[] {
  const q = query.trim().toLowerCase();
  const now = new Date();
  const today = startOfDay(now);
  const weekStart = startOfWeek(now);

  return bookings.filter((booking) => {
    if (q) {
      const haystack = [
        booking.Ime,
        booking.Gmail,
        booking.Phone,
        booking.Service,
        booking.Staff,
        booking.Notes,
        booking.Bookingid,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (statusFilter !== "all") {
      const s = booking.Status?.toString().trim().toLowerCase();
      if (s !== statusFilter) return false;
    }

    if (dateFilter !== "all") {
      const d = parseBookingDate(booking.Datum);
      if (!d) return false;

      if (dateFilter === "today") {
        if (d < today || d >= addDays(today, 1)) return false;
      } else if (dateFilter === "week") {
        if (d < weekStart || d >= addDays(weekStart, 7)) return false;
      } else if (dateFilter === "month") {
        if (
          d.getFullYear() !== now.getFullYear() ||
          d.getMonth() !== now.getMonth()
        )
          return false;
      } else if (dateFilter === "upcoming") {
        if (d < today) return false;
      }
    }

    return true;
  });
}
