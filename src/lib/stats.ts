import type { Booking, BookingStats } from "@/types/booking";

/**
 * Parse a date string from the Datum column into a local-time Date.
 * Handles the two most common formats used in European/Slovenian sheets:
 *   - DD.MM.YYYY  (e.g. 20.05.2026)
 *   - YYYY-MM-DD  (e.g. 2026-05-20)
 * Falls back to Date constructor for other formats. Returns null when
 * the string is empty or cannot be parsed.
 */
function parseBookingDate(raw: string): Date | null {
  const s = raw?.trim();
  if (!s) return null;

  // DD.MM.YYYY or D.M.YYYY (European / Slovenian)
  const euro = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (euro) {
    const d = new Date(
      parseInt(euro[3]),
      parseInt(euro[2]) - 1,
      parseInt(euro[1])
    );
    if (!isNaN(d.getTime())) return d;
  }

  // YYYY-MM-DD (ISO — parse as local time, not UTC)
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(
      parseInt(iso[1]),
      parseInt(iso[2]) - 1,
      parseInt(iso[3])
    );
    if (!isNaN(d.getTime())) return d;
  }

  // Last resort: native parse (handles MM/DD/YYYY etc.)
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

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
