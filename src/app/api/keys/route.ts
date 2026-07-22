import { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/api";
import { requireRole, requireTenant } from "@/lib/auth/context";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "@/lib/repositories/apiKeys";

/** Owner-only management of machine API keys (used by n8n). */

export async function GET() {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    requireRole(ctx, "owner");
    const keys = await listApiKeys(ctx.salon.id);
    return {
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        lastUsedAt: k.lastUsedAt,
        revokedAt: k.revokedAt,
        createdAt: k.createdAt,
      })),
    };
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    requireRole(ctx, "owner");
    const { name } = z
      .object({ name: z.string().trim().min(1).max(100) })
      .parse(await request.json());

    const { record, rawKey } = await createApiKey(ctx.salon.id, name);
    // rawKey is returned exactly once — it is never retrievable again.
    return { id: record.id, name: record.name, key: rawKey };
  });
}

export async function DELETE(request: NextRequest) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    requireRole(ctx, "owner");
    const { id } = z
      .object({ id: z.string().uuid() })
      .parse(await request.json());
    await revokeApiKey(ctx.salon.id, id);
    return { success: true };
  });
}
