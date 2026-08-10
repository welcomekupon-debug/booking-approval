import { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireRole, requireTenant } from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import { revokeInvite } from "@/lib/services/team";
import { zUuid } from "@/lib/validators/booking";

interface Params {
  params: Promise<{ id: string }>;
}

/** DELETE /api/team/invite/[id] — revoke a pending invite. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    requireRole(ctx, "manager");

    const { id } = await params;
    if (!zUuid.safeParse(id).success) throw ApiError.badRequest("Invalid invite id.");

    await revokeInvite(ctx, id);
    return { success: true };
  });
}
