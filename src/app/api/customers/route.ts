import { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/api";
import { requireTenant } from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import { db } from "@/lib/db";
import { and, eq, isNull } from "drizzle-orm";
import { customers } from "@/lib/db/schema";
import { updateCustomer } from "@/lib/repositories/customers";

const legacyCustomerMeta = z.strictObject({
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).default(""),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  vip: z.boolean().default(false),
  notes: z.string().trim().max(5000).default(""),
});

/** Legacy upsert of customer metadata, keyed by email. */
export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    const body = legacyCustomerMeta.parse(await request.json());
    const email = body.email.toLowerCase();

    const existing = await db.query.customers.findFirst({
      where: and(
        eq(customers.salonId, ctx.salon.id),
        eq(customers.email, email),
        isNull(customers.deletedAt)
      ),
    });

    if (!existing) {
      throw ApiError.notFound(
        "Customer not found — customers are created from their bookings."
      );
    }

    await updateCustomer(ctx.salon.id, existing.id, {
      phone: body.phone || null,
      tags: body.tags,
      isVip: body.vip,
      notes: body.notes || null,
    });

    return { success: true };
  });
}
