import { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireRole, requireTenant } from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import { endPromo, startPromo } from "@/lib/services/pricing";
import { promoSchema } from "@/lib/validators/catalog";
import { zUuid } from "@/lib/validators/booking";

interface Params {
  params: Promise<{ id: string }>;
}

/** POST /api/services/[id]/promo — schedule or replace the service's promotion. */
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    requireRole(ctx, "manager");

    const { id } = await params;
    if (!zUuid.safeParse(id).success) throw ApiError.badRequest("Invalid service id.");

    const body = promoSchema.parse(await request.json());
    const updated = await startPromo(
      ctx,
      id,
      {
        label: body.label,
        type: body.type,
        value: body.value,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
      },
      { type: "user", userId: ctx.user.id }
    );

    return { id: updated.id };
  });
}

/** DELETE /api/services/[id]/promo — end the promotion early. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    requireRole(ctx, "manager");

    const { id } = await params;
    if (!zUuid.safeParse(id).success) throw ApiError.badRequest("Invalid service id.");

    const updated = await endPromo(ctx, id, { type: "user", userId: ctx.user.id });
    return { id: updated.id };
  });
}
