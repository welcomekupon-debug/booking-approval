import { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireTenant } from "@/lib/auth/context";
import { createBooking } from "@/lib/services/booking";
import { createAppointmentSchema } from "@/lib/validators/booking";

/** POST /api/appointments — staff-created booking (confirmed immediately). */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    const body = createAppointmentSchema.parse(await request.json());

    const appointment = await createBooking(
      {
        salonId: ctx.salon.id,
        source: "staff",
        customer: body.customer,
        serviceIds: body.serviceIds,
        staffId: body.staffId ?? null,
        startsAt: body.startsAt,
        customerNote: body.customerNote ?? null,
        internalNote: body.internalNote ?? null,
        allowConflicts: body.allowConflicts ?? false,
      },
      { type: "user", userId: ctx.user.id }
    );

    return { success: true, appointmentId: appointment.id };
  });
}
