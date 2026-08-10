import { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireRole, requireTenant } from "@/lib/auth/context";
import { inviteMember } from "@/lib/services/team";
import { inviteMemberSchema } from "@/lib/validators/team";
import { appBaseUrl } from "@/lib/services/manageToken";

/** POST /api/team/invite — invite a teammate by email + role. */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    requireRole(ctx, "manager");

    const body = inviteMemberSchema.parse(await request.json());
    const invitation = await inviteMember(ctx, body.email, body.role);

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      acceptUrl: `${appBaseUrl()}/invite/${invitation.token}`,
    };
  });
}
