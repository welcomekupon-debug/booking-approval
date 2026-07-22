import { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/api";
import { requireTenant } from "@/lib/auth/context";
import { markAllRead, markRead } from "@/lib/repositories/notifications";

const readSchema = z.object({
  action: z.enum(["readAll", "read"]),
  ids: z.array(z.string().uuid()).max(100).optional(),
});

/** POST /api/notifications — mark read (all, or specific ids). */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    const body = readSchema.parse(await request.json());

    if (body.action === "readAll") {
      await markAllRead(ctx.salon.id, ctx.user.id);
    } else {
      await markRead(ctx.salon.id, ctx.user.id, body.ids ?? []);
    }
    return { success: true };
  });
}
