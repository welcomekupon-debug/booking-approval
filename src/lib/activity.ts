import type { Booking, ActivityItem } from "@/types/booking";

/** Minimal shape this file needs from a review — matches `/api/reviews`. */
export interface RecentReview {
  id: string;
  customerName: string;
  rating: number;
  createdAt: string;
}

/**
 * Derive a sorted activity feed from bookings + reviews.
 *
 * Rules:
 *  - Only "confirmed", "declined", and "cancelled" bookings are included
 *  - Bookings without an UpdatedAt timestamp are excluded (they pre-date
 *    this feature and cannot be sorted correctly)
 *  - Every review passed in is included (callers already scope which
 *    reviews the viewer is allowed to see)
 *  - Results are sorted newest-first by timestamp
 *  - Capped at `limit` items (default 10)
 *
 * Pure function — safe to call inside useMemo.
 */
export function getRecentActivity(
  bookings: Booking[],
  reviews: RecentReview[] = [],
  limit = 10
): ActivityItem[] {
  const bookingItems: ActivityItem[] = bookings
    .filter((b) => {
      const s = b.Status?.trim().toLowerCase();
      return (s === "confirmed" || s === "declined" || s === "cancelled") && b.UpdatedAt;
    })
    .map((b) => ({
      type: "booking",
      id: b.id,
      Ime: b.Ime,
      Status: b.Status,
      UpdatedAt: b.UpdatedAt,
    }));

  const reviewItems: ActivityItem[] = reviews.map((r) => ({
    type: "review",
    id: r.id,
    Ime: r.customerName,
    rating: r.rating,
    UpdatedAt: r.createdAt,
  }));

  return [...bookingItems, ...reviewItems]
    .sort((a, b) => new Date(b.UpdatedAt).getTime() - new Date(a.UpdatedAt).getTime())
    .slice(0, limit);
}
