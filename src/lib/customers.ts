import type { Booking } from "@/types/booking";
import type { Customer, CustomerMeta } from "@/types/app";
import { bookingDateTime, parseBookingDate } from "@/lib/dates";
import { normStatus } from "@/lib/stats";

/**
 * Derive rich customer profiles by grouping bookings by email and overlaying
 * stored metadata (tags / VIP / notes) from the Customers tab.
 */
export function deriveCustomers(
  bookings: Booking[],
  meta: CustomerMeta[]
): Customer[] {
  const metaByEmail = new Map(meta.map((m) => [m.email, m]));
  const groups = new Map<string, Booking[]>();

  for (const b of bookings) {
    const email = b.Gmail?.trim().toLowerCase();
    if (!email) continue;
    const list = groups.get(email);
    if (list) list.push(b);
    else groups.set(email, [b]);
  }

  const now = new Date();
  const customers: Customer[] = [];

  for (const [email, list] of Array.from(groups.entries())) {
    const m = metaByEmail.get(email);

    let confirmed = 0;
    let declined = 0;
    let pending = 0;
    let first: Date | null = null;
    let last: Date | null = null;
    let next: Booking | null = null;
    let nextDate: Date | null = null;
    let lifetimeValue = 0;
    let phone = m?.phone ?? "";
    let name = "";

    for (const b of list) {
      const s = normStatus(b);
      if (s === "confirmed") confirmed++;
      else if (s === "declined") declined++;
      else if (s === "pending") pending++;

      if (b.Ime?.trim()) name = b.Ime.trim();
      if (!phone && b.Phone?.trim()) phone = b.Phone.trim();

      if (s === "confirmed") {
        const price = parseFloat(String(b.Price).replace(",", "."));
        if (!isNaN(price)) lifetimeValue += price;
      }

      const d = parseBookingDate(b.Datum);
      if (d) {
        if (!first || d < first) first = d;
        if (!last || d > last) last = d;
        if (d >= now && s !== "declined") {
          const dt = bookingDateTime(b.Datum, b.Ura) ?? d;
          if (!nextDate || dt < nextDate) {
            nextDate = dt;
            next = b;
          }
        }
      }
    }

    customers.push({
      email,
      name: name || email,
      phone,
      tags: m?.tags ?? [],
      vip: m?.vip ?? false,
      notes: m?.notes ?? "",
      totalBookings: list.length,
      confirmed,
      declined,
      pending,
      firstBooking: first,
      lastBooking: last,
      nextBooking: next,
      lifetimeValue: Math.round(lifetimeValue * 100) / 100,
      bookings: [...list].sort((a, b) => {
        const da = parseBookingDate(a.Datum)?.getTime() ?? 0;
        const db = parseBookingDate(b.Datum)?.getTime() ?? 0;
        return db - da;
      }),
    });
  }

  // VIPs first, then by booking count
  return customers.sort((a, b) => {
    if (a.vip !== b.vip) return a.vip ? -1 : 1;
    return b.totalBookings - a.totalBookings;
  });
}
