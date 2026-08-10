import { handleRoute } from "@/lib/api";
import { requireTenant } from "@/lib/auth/context";
import { listTeam } from "@/lib/services/team";
import { roleLabelsFor } from "@/lib/roleLabels";
import { appBaseUrl } from "@/lib/services/manageToken";

/** GET /api/team — members + outstanding invites for the current salon. */
export async function GET() {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    const { members, invitations } = await listTeam(ctx);

    return {
      currentUserId: ctx.user.id,
      currentRole: ctx.role,
      roleLabels: roleLabelsFor(ctx.salon.category),
      members: members.map((m) => ({
        membershipId: m.membership.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        imageUrl: m.user.imageUrl,
        role: m.membership.role,
        joinedAt: m.membership.createdAt.toISOString(),
      })),
      invitations: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
        expiresAt: i.expiresAt.toISOString(),
        // Only useful while still pending, but harmless either way — lets
        // the owner copy/share the link directly if the invite email never
        // arrives (e.g. n8n isn't wired up for this event yet).
        acceptUrl: `${appBaseUrl()}/invite/${i.token}`,
      })),
    };
  });
}
