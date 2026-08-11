import { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireRole, requireTenant } from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import { linkMembershipToStaff } from "@/lib/services/team";
import { linkStaffSchema } from "@/lib/validators/team";
import { zUuid } from "@/lib/validators/booking";

interface Params {
  params: Promise<{ membershipId: string }>;
}

/** PATCH /api/team/[membershipId]/staff — link/unlink a teammate's bookable staff profile. */
export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    requireRole(ctx, "manager");

    const { membershipId } = await params;
    if (!zUuid.safeParse(membershipId).success) {
      throw ApiError.badRequest("Invalid membership id.");
    }

    const { staffId } = linkStaffSchema.parse(await request.json());
    const updated = await linkMembershipToStaff(ctx, membershipId, staffId);

    return { membershipId: updated.id, staffId: updated.staffId };
  });
}
