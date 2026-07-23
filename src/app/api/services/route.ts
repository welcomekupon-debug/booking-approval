import { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/api";
import { requireRole, requireTenant } from "@/lib/auth/context";
import {
  createService,
  listServices,
  softDeleteService,
  updateService,
} from "@/lib/repositories/catalog";
import { decimalToCents } from "@/lib/legacy/mapper";

const legacyServiceList = z.strictObject({
  services: z
    .array(
      z.strictObject({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(200),
        duration: z.string().trim().max(20),
        price: z.string().trim().max(20),
        color: z.string().trim().max(20).default(""),
        active: z.boolean().default(true),
      })
    )
    .max(500),
});

/**
 * Legacy full-list PUT translated into a diff:
 * rows with a known id are updated, new rows created, missing ids soft-deleted.
 */
export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    requireRole(ctx, "manager");
    const salonId = ctx.salon.id;

    const { services: incoming } = legacyServiceList.parse(
      await request.json()
    );

    const existing = await listServices(salonId, { includeInactive: true });
    const incomingIds = new Set(incoming.map((s) => s.id).filter(Boolean));

    for (const row of incoming) {
      const fields = {
        name: row.name,
        durationMinutes: parseInt(row.duration, 10) || 30,
        priceCents: decimalToCents(row.price) ?? 0,
        color: row.color || null,
        isActive: row.active,
      };
      if (row.id && existing.some((e) => e.id === row.id)) {
        await updateService(salonId, row.id, fields);
      } else {
        await createService(salonId, fields);
      }
    }

    for (const gone of existing.filter((e) => !incomingIds.has(e.id))) {
      await softDeleteService(salonId, gone.id);
    }

    return { success: true };
  });
}
