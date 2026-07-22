export const dynamic = "force-dynamic";

import { handleRoute } from "@/lib/api";
import { requireTenant } from "@/lib/auth/context";
import { listAppointments } from "@/lib/repositories/appointments";
import { mapAppointment } from "@/lib/legacy/mapper";

export async function GET() {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    const { items } = await listAppointments(ctx.salon.id, {
      limit: 200,
      order: "desc",
    });
    return {
      bookings: items.map((a) => mapAppointment(a, ctx.salon.timezone)),
      client: { clientName: ctx.salon.name },
    };
  });
}
