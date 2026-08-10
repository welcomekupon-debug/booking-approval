import { handleRoute } from "@/lib/api";
import { getOrCreateUser } from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import { acceptInvite } from "@/lib/services/team";

interface Params {
  params: Promise<{ token: string }>;
}

/**
 * POST /api/invite/[token]/accept — claim an invite. Requires a signed-in
 * Clerk session (any account is fine to exist first; this is where it gets
 * attached to the salon) whose verified email matches the invite.
 */
export async function POST(_request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await getOrCreateUser();
    if (!user) throw ApiError.unauthorized("Sign in to accept this invite.");

    const { token } = await params;
    const result = await acceptInvite(token, user);
    return result;
  });
}
