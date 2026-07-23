import type { Booking, ActivityItem } from "@/types/booking";

/**
 * Derive a sorted activity feed from a full bookings array.
 *
 * Rules:
 *  - Only "confirmed", "declined", and "cancelled" bookings are included
 *  - Bookings without an UpdatedAt timestamp are excluded (they pre-date
 *    this feature and cannot be sorted correctly)
 *  - Results are sorted newest-first by UpdatedAt
 *  - Capped at `limit` items (default 10)
 *
 * Pure function — safe to call inside useMemo.
 */
export function getRecentActivity(
  bookings: Booking[],
  limit = 10
): ActivityItem[] {
  return bookings
    .filter((b) => {
      const s = b.Status?.trim().toLowerCase();
      return (s === "confirmed" || s === "declined" || s === "cancelled") && b.UpdatedAt;
    })
    .sort((a, b) => {
      const tA = new Date(a.UpdatedAt).getTime();
      const tB = new Date(b.UpdatedAt).getTime();
      return tB - tA; // newest first
    })
    .slice(0, limit)
    .map((b) => ({
      id: b.id,
      Ime: b.Ime,
      Status: b.Status,
      UpdatedAt: b.UpdatedAt,
    }));
}
