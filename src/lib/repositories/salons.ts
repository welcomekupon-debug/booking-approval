import { and, eq, isNull } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { memberships, salons, settings, users } from "@/lib/db/schema";
import type { Salon, SalonPlan } from "@/lib/db/types";

/** Public lookup for /book/{slug}. */
export async function getSalonBySlug(slug: string): Promise<Salon | null> {
  const row = await db.query.salons.findFirst({
    where: and(eq(salons.slug, slug), isNull(salons.deletedAt)),
  });
  return row ?? null;
}

/** Used when only the id is on hand — e.g. assembling an email payload. */
export async function getSalonById(id: string): Promise<Salon | null> {
  const row = await db.query.salons.findFirst({
    where: and(eq(salons.id, id), isNull(salons.deletedAt)),
  });
  return row ?? null;
}

export async function updateSalon(
  salonId: string,
  patch: Partial<
    Pick<
      Salon,
      | "name"
      | "businessType"
      | "category"
      | "country"
      | "email"
      | "phone"
      | "website"
      | "address"
      | "logoUrl"
      | "brandColor"
      | "currency"
      | "timezone"
      | "googleReviewUrl"
    >
  >
): Promise<Salon> {
  const [row] = await db
    .update(salons)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(salons.id, salonId))
    .returning();
  return row;
}

/**
 * Platform-admin only — changes a salon's subscription tier and/or its
 * Custom-plan entitlement overrides (the latter are ignored by
 * `resolveEntitlements` unless `plan` is "custom", but can be set ahead of
 * or independently from the plan switch).
 */
export async function updateSalonPlan(
  salonId: string,
  patch: {
    plan?: SalonPlan;
    customMaxStaff?: number | null;
    customAnalytics?: boolean;
    customSelfServiceBooking?: boolean;
    customApiAccess?: boolean;
  }
): Promise<Salon> {
  const [row] = await db
    .update(salons)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(salons.id, salonId))
    .returning();
  return row;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    // strip combining diacritics left over from NFKD
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 48);
}

/**
 * Create a salon + owner membership + default settings in one transaction.
 * Called from onboarding for users with no membership yet.
 */
export async function createSalonForUser(
  userId: string,
  data: { name: string; timezone?: string; currency?: string }
): Promise<Salon> {
  return db.transaction(async (tx) => {
    const base = slugify(data.name) || "salon";
    let slug = base;

    // Ensure slug uniqueness (small loop; collisions are rare)
    for (let i = 2; i < 50; i++) {
      const clash = await tx.query.salons.findFirst({
        where: eq(salons.slug, slug),
        columns: { id: true },
      });
      if (!clash) break;
      slug = `${base}-${i}`;
    }

    const [salon] = await tx
      .insert(salons)
      .values({
        name: data.name,
        slug,
        timezone: data.timezone ?? "Europe/Ljubljana",
        currency: data.currency ?? "EUR",
      })
      .returning();

    await tx.insert(memberships).values({
      userId,
      salonId: salon.id,
      role: "owner",
    });

    await tx.insert(settings).values({ salonId: salon.id });

    return salon;
  });
}

/** Platform-admin only — every salon, with its owner(s) for a picker UI. */
export async function listAllSalonsForAdmin(): Promise<
  { salon: Salon; owners: { name: string | null; email: string }[] }[]
> {
  const allSalons = await db
    .select()
    .from(salons)
    .where(isNull(salons.deletedAt))
    .orderBy(salons.createdAt);

  const owners = await db
    .select({
      salonId: memberships.salonId,
      name: users.name,
      email: users.email,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.role, "owner"));

  const ownersBySalon = new Map<string, { name: string | null; email: string }[]>();
  for (const o of owners) {
    const list = ownersBySalon.get(o.salonId) ?? [];
    list.push({ name: o.name, email: o.email });
    ownersBySalon.set(o.salonId, list);
  }

  return allSalons.map((salon) => ({
    salon,
    owners: ownersBySalon.get(salon.id) ?? [],
  }));
}

export type { DbOrTx };
