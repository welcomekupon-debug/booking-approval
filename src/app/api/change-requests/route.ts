import { handleRoute } from "@/lib/api";
import { requireTenant } from "@/lib/auth/context";
import { listPendingChangeRequests } from "@/lib/repositories/changeRequests";

/** GET /api/change-requests — pending cancel/reschedule requests for the salon. */
export async function GET() {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    const items = await listPendingChangeRequests(ctx.salon.id);
    return {
      requests: items.map((r) => ({
        id: r.id,
        appointmentId: r.appointmentId,
        type: r.type,
        requestedStartsAt: r.requestedStartsAt?.toISOString() ?? null,
        customerNote: r.customerNote,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });
}
