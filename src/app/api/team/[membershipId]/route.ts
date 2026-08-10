import { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireRole, requireTenant } from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import { changeMemberRole, removeMember } from "@/lib/services/team";
import { changeMemberRoleSchema } from "@/lib/validators/team";
import { zUuid } from "@/lib/validators/booking";

interface Params {
  params: Promise<{ membershipId: string }>;
}

/** PATCH /api/team/[membershipId] — change a teammate's role. */
export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    requireRole(ctx, "manager");

    const { membershipId } = await params;
    if (!zUuid.safeParse(membershipId).success) {
      throw ApiError.badRequest("Invalid membership id.");
    }

    const body = changeMemberRoleSchema.parse(await request.json());
    const updated = await changeMemberRole(ctx, membershipId, body.role);

    return { membershipId: updated.id, role: updated.role };
  });
}

/** DELETE /api/team/[membershipId] — remove a teammate from the salon. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    requireRole(ctx, "manager");

    const { membershipId } = await params;
    if (!zUuid.safeParse(membershipId).success) {
      throw ApiError.badRequest("Invalid membership id.");
    }

    await removeMember(ctx, membershipId);
    return { success: true };
  });
}
