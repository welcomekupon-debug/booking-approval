import { cookies } from "next/headers";
import { currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberships, salons, users } from "@/lib/db/schema";
import type { Membership, MembershipRole, Salon, User } from "@/lib/db/types";
import { ApiError } from "@/lib/errors";

/**
 * Tenant context — the single place where "who is this and which salon are
 * they acting on" is resolved. Replaces the old Sheets `resolveClient()`.
 *
 * Security model:
 * • Identity comes ONLY from Clerk (clerk_user_id).
 * • Tenant comes ONLY from a verified membership row — never from client
 *   input. The active-salon cookie is a *preference*; it is validated
 *   against the user's memberships on every request.
 * • Repositories then scope every query by ctx.salon.id.
 */

export interface TenantContext {
  user: User;
  membership: Membership;
  salon: Salon;
  role: MembershipRole;
}

const ACTIVE_SALON_COOKIE = "active_salon_id";

/** Find-or-create the local user row for the signed-in Clerk account. */
export async function getOrCreateUser(): Promise<User | null> {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email =
    clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) return null;

  const existing = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUser.id),
  });

  if (existing) {
    // Keep profile fresh (cheap, single row)
    if (existing.email !== email || existing.name !== clerkUser.fullName) {
      const [updated] = await db
        .update(users)
        .set({
          email,
          name: clerkUser.fullName,
          imageUrl: clerkUser.imageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }

  // The Sheets import creates placeholder users ("pending:<email>") with
  // memberships already attached. First sign-in claims that row, which
  // links the Clerk account to the imported salon.
  const pending = await db.query.users.findFirst({
    where: eq(users.clerkUserId, `pending:${email.toLowerCase()}`),
  });
  if (pending) {
    const [claimed] = await db
      .update(users)
      .set({
        clerkUserId: clerkUser.id,
        email,
        name: clerkUser.fullName,
        imageUrl: clerkUser.imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, pending.id))
      .returning();
    return claimed;
  }

  const [created] = await db
    .insert(users)
    .values({
      clerkUserId: clerkUser.id,
      email,
      name: clerkUser.fullName,
      imageUrl: clerkUser.imageUrl,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: { email, updatedAt: new Date() },
    })
    .returning();

  return created;
}

/** All salons the current user belongs to (for the salon switcher). */
export async function getUserMemberships(
  userId: string
): Promise<{ membership: Membership; salon: Salon }[]> {
  const rows = await db
    .select({ membership: memberships, salon: salons })
    .from(memberships)
    .innerJoin(salons, eq(memberships.salonId, salons.id))
    .where(eq(memberships.userId, userId));

  return rows.filter((r) => r.salon.deletedAt === null);
}

/**
 * Resolve the full tenant context, or null when the user is signed in but
 * has no salon yet (→ onboarding creates one).
 * Throws ApiError(401) when not signed in.
 */
export async function getTenantContext(): Promise<
  { user: User; ctx: TenantContext | null }
> {
  const user = await getOrCreateUser();
  if (!user) throw ApiError.unauthorized();

  const all = await getUserMemberships(user.id);
  if (all.length === 0) return { user, ctx: null };

  // Preferred salon from cookie — validated against real memberships
  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_SALON_COOKIE)?.value;
  const match =
    (preferred && all.find((m) => m.salon.id === preferred)) || all[0];

  return {
    user,
    ctx: {
      user,
      membership: match.membership,
      salon: match.salon,
      role: match.membership.role,
    },
  };
}

/** Like getTenantContext, but 403s when the user has no salon membership. */
export async function requireTenant(): Promise<TenantContext> {
  const { ctx } = await getTenantContext();
  if (!ctx) {
    throw ApiError.forbidden(
      "No salon found for this account. Complete onboarding first."
    );
  }
  return ctx;
}

const ROLE_RANK: Record<MembershipRole, number> = {
  owner: 4,
  manager: 3,
  receptionist: 2,
  stylist: 1,
};

/** Assert the context's role is at least `minimum`. */
export function requireRole(
  ctx: TenantContext,
  minimum: MembershipRole
): void {
  if (ROLE_RANK[ctx.role] < ROLE_RANK[minimum]) {
    throw ApiError.forbidden(
      `This action requires the ${minimum} role or higher.`
    );
  }
}

export { ACTIVE_SALON_COOKIE };
