export const dynamic = "force-dynamic";

import { handleRoute } from "@/lib/api";
import { getTenantContext } from "@/lib/auth/context";
import { listAppointments } from "@/lib/repositories/appointments";
import { listServices, listStaff } from "@/lib/repositories/catalog";
import { listCustomers } from "@/lib/repositories/customers";
import { listBlockedTimes, listBusinessHours } from "@/lib/repositories/hours";
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
        bookings: [],
        services: [],
        staff: [],
        customerMeta: [],
        settings: { ...DEFAULT_SETTINGS, onboardingComplete: false },
      };
    }

    const { salon } = ctx;

    // Bounded window: everything upcoming (1 year) + 1 year of history.
    const now = Date.now();
    const yearMs = 365 * 24 * 3600_000;

    const [appointments, services, staff, customers, settings, hours, blocks] =
      await Promise.all([
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
      ]);

    return {
      clientName: salon.name,
      bookings: appointments.items.map((a) => mapAppointment(a, salon.timezone)),
      services: services.map(mapService),
      staff: staff.map(mapStaff),
      customerMeta: customers.items.map(mapCustomerMeta),
      settings: mapSettings(salon, settings, hours, blocks),
    };
  });
}
