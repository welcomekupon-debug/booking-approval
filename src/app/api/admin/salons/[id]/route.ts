import { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/api";
import { requirePlatformAdmin } from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import { db } from "@/lib/db";
import { getSalonById, updateSalonPlan } from "@/lib/repositories/salons";
import { recordAudit } from "@/lib/repositories/audit";
import { updateSalonPlanSchema } from "@/lib/validators/team";

/** PATCH /api/admin/salons/[id] — platform-admin: change a salon's plan. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const admin = await requirePlatformAdmin();
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw ApiError.badRequest("Invalid salon id.");
    }

    const salon = await getSalonById(id);
    if (!salon) throw ApiError.notFound("Salon not found.");

    const json = await request.json().catch(() => null);
    if (!json) throw ApiError.badRequest("Invalid JSON body.");
    const { plan, customEntitlements } = updateSalonPlanSchema.parse(json);

    const before = {
      plan: salon.plan,
      customMaxStaff: salon.customMaxStaff,
      customAnalytics: salon.customAnalytics,
      customSelfServiceBooking: salon.customSelfServiceBooking,
      customApiAccess: salon.customApiAccess,
    };

    const updated = await updateSalonPlan(id, {
      ...(plan !== undefined ? { plan } : {}),
      ...(customEntitlements !== undefined
        ? {
            customMaxStaff: customEntitlements.maxStaff,
            customAnalytics: customEntitlements.analytics,
            customSelfServiceBooking: customEntitlements.selfServiceBooking,
            customApiAccess: customEntitlements.apiAccess,
          }
        : {}),
    });

    await recordAudit(db, {
      salonId: id,
      actorType: "user",
      actorUserId: admin.id,
      action: "admin.plan_changed",
      entityType: "salon",
      entityId: id,
      changes: {
        from: before,
        to: {
          plan: updated.plan,
          customMaxStaff: updated.customMaxStaff,
          customAnalytics: updated.customAnalytics,
          customSelfServiceBooking: updated.customSelfServiceBooking,
          customApiAccess: updated.customApiAccess,
        },
      },
    });

    return {
      salonId: updated.id,
      plan: updated.plan,
      customEntitlements: {
        maxStaff: updated.customMaxStaff,
        analytics: updated.customAnalytics,
        selfServiceBooking: updated.customSelfServiceBooking,
        apiAccess: updated.customApiAccess,
      },
    };
  });
}
