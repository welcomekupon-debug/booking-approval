import { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/api";
import { requireRole, requireTenant } from "@/lib/auth/context";
import {
  createStaff,
  listStaff,
  softDeleteStaff,
  updateStaff,
} from "@/lib/repositories/catalog";

const legacyStaffList = z.strictObject({
  staff: z
    .array(
      z.strictObject({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(200),
        email: z.string().trim().max(320).default(""),
        phone: z.string().trim().max(40).default(""),
        role: z.string().trim().max(100).default(""),
        color: z.string().trim().max(20).default(""),
        active: z.boolean().default(true),
      })
    )
    .max(200),
});

/** Legacy full-list PUT → diff-based upsert (same pattern as services). */
export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    requireRole(ctx, "manager");
    const salonId = ctx.salon.id;

    const { staff: incoming } = legacyStaffList.parse(await request.json());

    const existing = await listStaff(salonId, { includeInactive: true });
    const incomingIds = new Set(incoming.map((s) => s.id).filter(Boolean));

    for (const row of incoming) {
      const fields = {
        name: row.name,
        email: row.email || null,
        phone: row.phone || null,
        roleTitle: row.role || null,
        color: row.color || null,
        isActive: row.active,
      };
      if (row.id && existing.some((e) => e.id === row.id)) {
        await updateStaff(salonId, row.id, fields);
      } else {
        await createStaff(salonId, fields);
      }
    }

    for (const gone of existing.filter((e) => !incomingIds.has(e.id))) {
      await softDeleteStaff(salonId, gone.id);
    }

    return { success: true };
  });
}
