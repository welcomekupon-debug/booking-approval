import { cookies } from "next/headers";
import { currentUser } from "@clerk/nextjs/server";
import { and, asc, eq } from "drizzle-orm";
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
  /** Null while impersonating — there is no real membership row in play. */
  membership: Membership | null;
  salon: Salon;
  role: MembershipRole;
  /** True when a platform admin is viewing this salon via impersonation. */
  impersonating: boolean;
}

const ACTIVE_SALON_COOKIE = "active_salon_id";
/** Platform-admin-only. Set/cleared by /api/admin/impersonate. */
const IMPERSONATE_SALON_COOKIE = "impersonate_salon_id";

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

/**
 * All salons the current user belongs to (for the salon switcher).
 * Ordered by membership.createdAt so `all[0]` — the fallback used when no
 * active-salon cookie is set — is always the salon they joined first,
 * rather than whatever order Postgres happens to return (which is NOT
 * guaranteed without an explicit ORDER BY, and can silently change between
 * requests for anyone with more than one membership).
 */
export async function getUserMemberships(
  userId: string
): Promise<{ membership: Membership; salon: Salon }[]> {
  const rows = await db
    .select({ membership: memberships, salon: salons })
    .from(memberships)
    .innerJoin(salons, eq(memberships.salonId, salons.id))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt));

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

  // Impersonation short-circuits normal membership resolution entirely —
  // a platform admin doesn't need (and shouldn't get) a membership row on
  // the client's salon just to help them set it up.
  if (user.isPlatformAdmin) {
    const cookieStore = await cookies();
    const impersonateId = cookieStore.get(IMPERSONATE_SALON_COOKIE)?.value;
    if (impersonateId) {
      const salon = await db.query.salons.findFirst({
        where: eq(salons.id, impersonateId),
      });
      if (salon && salon.deletedAt === null) {
        return {
          user,
          ctx: {
            user,
            membership: null,
            salon,
            role: "owner",
            impersonating: true,
          },
        };
      }
    }
  }

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
      impersonating: false,
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

export { ROLE_RANK };

/** Signed-in user, 403 unless they carry the platform-admin flag. */
export async function requirePlatformAdmin(): Promise<User> {
  const user = await getOrCreateUser();
  if (!user) throw ApiError.unauthorized();
  if (!user.isPlatformAdmin) {
    throw ApiError.forbidden("Platform admin access required.");
  }
  return user;
}

export { ACTIVE_SALON_COOKIE, IMPERSONATE_SALON_COOKIE };
