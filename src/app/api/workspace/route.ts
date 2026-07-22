export const dynamic = "force-dynamic";

import { handleRoute } from "@/lib/api";
import { getTenantContext } from "@/lib/auth/context";
import { listAppointments } from "@/lib/repositories/appointments";
import { listServices, listStaff } from "@/lib/repositories/catalog";
import { listCustomers } from "@/lib/repositories/customers";
import { listBlockedTimes, listBusinessHours } from "@/lib/repositories/hours";
import { listNotifications } from "@/lib/repositories/notifications";
import { getSettings } from "@/lib/repositories/settings";
import {
  mapAppointment,
  mapCustomerMeta,
  mapService,
  mapSettings,
  mapStaff,
} from "@/lib/legacy/mapper";
import { DEFAULT_SETTINGS } from "@/types/app";

/**
 * Bootstrap endpoint. Same response contract as the Sheets era, now served
 * from Postgres. A signed-in user without a salon gets an empty workspace
 * with onboardingComplete=false, which routes them into onboarding.
 */
export async function GET() {
  return handleRoute(async () => {
    const { ctx } = await getTenantContext();

    if (!ctx) {
      return {
        clientName: "",
        salonSlug: "",
        bookings: [],
        services: [],
        staff: [],
        customerMeta: [],
        notifications: [],
        settings: { ...DEFAULT_SETTINGS, onboardingComplete: false },
      };
    }

    const { salon } = ctx;

    // Bounded window: everything upcoming (1 year) + 1 year of history.
    const now = Date.now();
    const yearMs = 365 * 24 * 3600_000;

    const [
      appointments,
      services,
      staff,
      customers,
      settings,
      hours,
      blocks,
      notifications,
    ] = await Promise.all([
      listAppointments(salon.id, {
        from: new Date(now - yearMs),
        to: new Date(now + yearMs),
        limit: 200,
        order: "desc",
      }),
      listServices(salon.id, { includeInactive: true }),
      listStaff(salon.id, { includeInactive: true }),
      listCustomers(salon.id, { limit: 200 }),
      getSettings(salon.id),
      listBusinessHours(salon.id),
      listBlockedTimes(salon.id),
      listNotifications(salon.id, ctx.user.id, { limit: 50 }),
    ]);

    return {
      clientName: salon.name,
      salonSlug: salon.slug,
      bookings: appointments.items.map((a) => mapAppointment(a, salon.timezone)),
      services: services.map(mapService),
      staff: staff.map(mapStaff),
      customerMeta: customers.items.map(mapCustomerMeta),
      notifications: notifications.items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body ?? "",
        appointmentId: n.appointmentId,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
      })),
      settings: mapSettings(salon, settings, hours, blocks),
    };
  });
}
