import { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/api";
import { requireTenant } from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import {
  approveChangeRequest,
  declineChangeRequest,
} from "@/lib/services/changeRequests";

const bodySchema = z.strictObject({
  action: z.enum(["approve", "decline"]),
});

/** POST /api/change-requests/[id] — staff approves or declines a request. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw ApiError.badRequest("Invalid request id.");
    }

    const ctx = await requireTenant();
    const { action } = bodySchema.parse(await request.json());
    const actor = { type: "user" as const, userId: ctx.user.id };

    if (action === "approve") {
      await approveChangeRequest(ctx.salon.id, id, actor);
    } else {
      await declineChangeRequest(ctx.salon.id, id, actor);
    }

    return { success: true };
  });
}
