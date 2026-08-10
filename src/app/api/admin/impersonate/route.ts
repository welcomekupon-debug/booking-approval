import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { handleRoute } from "@/lib/api";
import { IMPERSONATE_SALON_COOKIE, requirePlatformAdmin } from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import { db } from "@/lib/db";
import { getSalonById } from "@/lib/repositories/salons";
import { recordAudit } from "@/lib/repositories/audit";
import { impersonateSchema } from "@/lib/validators/team";

/** POST /api/admin/impersonate — start viewing a salon as its owner. */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const admin = await requirePlatformAdmin();
    const { salonId } = impersonateSchema.parse(await request.json());

    const salon = await getSalonById(salonId);
    if (!salon) throw ApiError.notFound("Salon not found.");

    const cookieStore = await cookies();
    cookieStore.set(IMPERSONATE_SALON_COOKIE, salon.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 4,
    });

    await recordAudit(db, {
      salonId: salon.id,
      actorType: "user",
      actorUserId: admin.id,
      action: "admin.impersonate_start",
      entityType: "salon",
      entityId: salon.id,
    });

    return { salonId: salon.id, salonName: salon.name };
  });
}

/** DELETE /api/admin/impersonate — stop impersonating. */
export async function DELETE() {
  return handleRoute(async () => {
    const admin = await requirePlatformAdmin();
    const cookieStore = await cookies();
    const salonId = cookieStore.get(IMPERSONATE_SALON_COOKIE)?.value;
    cookieStore.delete(IMPERSONATE_SALON_COOKIE);

    if (salonId) {
      await recordAudit(db, {
        salonId,
        actorType: "user",
        actorUserId: admin.id,
        action: "admin.impersonate_stop",
        entityType: "salon",
        entityId: salonId,
      });
    }

    return { success: true };
  });
}
