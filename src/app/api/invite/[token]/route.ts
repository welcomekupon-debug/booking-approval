import { handleRoute } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { getInvitationPreview } from "@/lib/repositories/invitations";
import { roleLabel } from "@/lib/roleLabels";
import { db } from "@/lib/db";
import { salons } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface Params {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/invite/[token] — public preview for the accept-invite landing
 * page. No auth required (the token itself is the secret); only returns
 * non-sensitive info, never anything about the salon's actual data.
 */
export async function GET(_request: Request, { params }: Params) {
  return handleRoute(async () => {
    const { token } = await params;
    const preview = await getInvitationPreview(token);
    if (!preview) throw ApiError.notFound("This invite link isn't valid.");

    const salon = await db.query.salons.findFirst({
      where: eq(salons.id, preview.invitation.salonId),
    });

    const expired = preview.invitation.expiresAt.getTime() < Date.now();

    return {
      salonName: preview.salonName,
      invitedByName: preview.invitedByName,
      email: preview.invitation.email,
      role: preview.invitation.role,
      roleLabel: roleLabel(preview.invitation.role, salon?.category ?? "salon"),
      status: expired && preview.invitation.status === "pending"
        ? "expired"
        : preview.invitation.status,
    };
  });
}
