import type { Booking, BookingStats } from "@/types/booking";
import { parseBookingDate } from "@/lib/dates";

/**
 * Compute dashboard statistics from a full list of bookings.
 * Status values are normalised with trim().toLowerCase() before comparison.
 */
export function computeStats(bookings: Booking[]): BookingStats {
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();

  let pending = 0;
  let confirmed = 0;
  let declined = 0;
  let today = 0;
  let thisMonth = 0;

  for (const b of bookings) {
    const status = b.Status?.toString().trim().toLowerCase();

    if (status === "pending") pending++;
    else if (status === "confirmed") confirmed++;
    else if (status === "declined") declined++;

    const date = parseBookingDate(b.Datum);
    if (date) {
      if (
        date.getFullYear() === todayY &&
        date.getMonth() === todayM &&
        date.getDate() === todayD
      ) {
        today++;
      }
      if (date.getFullYear() === todayY && date.getMonth() === todayM) {
        thisMonth++;
      }
    }
  }

  return {
    total: bookings.length,
    pending,
    confirmed,
    declined,
    today,
    thisMonth,
  };
}
