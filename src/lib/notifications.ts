import type { Booking } from "@/types/booking";
import type { AppNotification } from "@/types/app";
import { bookingDateTime, isSameDay, startOfDay } from "@/lib/dates";
import { normStatus } from "@/lib/stats";

/**
 * Derive the notification feed from booking data — no extra storage needed.
 * Read state is kept in localStorage on the client.
 */
export function deriveNotifications(bookings: Booking[]): AppNotification[] {
  const now = new Date();
  const today = startOfDay(now);
  const items: AppNotification[] = [];

  for (const b of bookings) {
    const status = normStatus(b);
    const when = bookingDateTime(b.Datum, b.Ura);
    const updated = b.UpdatedAt ? new Date(b.UpdatedAt) : null;
    const idBase = b.Bookingid || String(b.id);

    if (status === "pending") {
      if (when && when < now) {
        items.push({
          id: `missed-${idBase}`,
          kind: "missed",
          title: "Missed request",
          body: `${b.Ime}'s request for ${b.Datum} ${b.Ura} was never answered.`,
          time: when,
          href: "/appointments?status=pending",
        });
      } else {
        items.push({
          id: `request-${idBase}`,
          kind: "request",
          title: "New booking request",
          body: `${b.Ime} requested ${b.Service ? b.Service + " on " : ""}${b.Datum} at ${b.Ura}.`,
          time: when,
          href: "/appointments?status=pending",
        });
      }
    }

    if (status === "confirmed" && updated && !isNaN(updated.getTime())) {
      items.push({
        id: `confirm-${idBase}`,
        kind: "confirmation",
        title: "Appointment confirmed",
        body: `${b.Ime} — ${b.Datum} at ${b.Ura}.`,
        time: updated,
        href: "/appointments?status=confirmed",
      });
    }

    if (status === "declined" && updated && !isNaN(updated.getTime())) {
      items.push({
        id: `cancel-${idBase}`,
        kind: "cancellation",
        title: "Appointment declined",
        body: `${b.Ime} — ${b.Datum} at ${b.Ura}.`,
        time: updated,
        href: "/appointments?status=declined",
      });
    }

    // Reminder: confirmed appointments happening today
    if (status === "confirmed" && when && isSameDay(when, today) && when >= now) {
      items.push({
        id: `remind-${idBase}`,
        kind: "reminder",
        title: "Upcoming today",
        body: `${b.Ime}${b.Service ? ` · ${b.Service}` : ""} at ${b.Ura}.`,
        time: when,
        href: "/calendar",
      });
    }
  }

  // Newest first; items without a time go last
  return items
    .sort((a, b) => (b.time?.getTime() ?? 0) - (a.time?.getTime() ?? 0))
    .slice(0, 50);
}
