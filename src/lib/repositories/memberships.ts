import { and, count, eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { memberships, users } from "@/lib/db/schema";
import type { Membership, MembershipRole, User } from "@/lib/db/types";

/** Team roster for the settings → Team tab. */
export async function listMembers(
  salonId: string
): Promise<{ membership: Membership; user: User }[]> {
  return db
    .select({ membership: memberships, user: users })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.salonId, salonId))
    .orderBy(memberships.createdAt);
}

export async function getMembership(
  salonId: string,
  membershipId: string
): Promise<Membership | null> {
  const row = await db.query.memberships.findFirst({
    where: and(eq(memberships.id, membershipId), eq(memberships.salonId, salonId)),
  });
  return row ?? null;
}

export async function countOwners(
  tx: DbOrTx,
  salonId: string
): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(memberships)
    .where(and(eq(memberships.salonId, salonId), eq(memberships.role, "owner")));
  return row?.n ?? 0;
}

/** Insert, or return the existing row unchanged if already a member. */
export async function createMembership(
  tx: DbOrTx,
  params: { userId: string; salonId: string; role: MembershipRole }
): Promise<Membership> {
  const [row] = await tx
    .insert(memberships)
    .values(params)
    .onConflictDoNothing({
      target: [memberships.userId, memberships.salonId],
    })
    .returning();

  if (row) return row;

  // Conflict path — row already existed, fetch it as-is (don't silently
  // change someone's role just because they were re-invited).
  const existing = await tx.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, params.userId),
      eq(memberships.salonId, params.salonId)
    ),
  });
  if (!existing) throw new Error("Membership insert conflicted but row not found.");
  return existing;
}

export async function updateMemberRole(
  salonId: string,
  membershipId: string,
  role: MembershipRole
): Promise<Membership | null> {
  const [row] = await db
    .update(memberships)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(memberships.id, membershipId), eq(memberships.salonId, salonId)))
    .returning();
  return row ?? null;
}

/** Link (or unlink, staffId=null) a team member's account to a bookable staff profile. */
export async function updateMembershipStaffLink(
  salonId: string,
  membershipId: string,
  staffId: string | null
): Promise<Membership | null> {
  const [row] = await db
    .update(memberships)
    .set({ staffId, updatedAt: new Date() })
    .where(and(eq(memberships.id, membershipId), eq(memberships.salonId, salonId)))
    .returning();
  return row ?? null;
}

export async function deleteMembership(
  salonId: string,
  membershipId: string
): Promise<boolean> {
  const [row] = await db
    .delete(memberships)
    .where(and(eq(memberships.id, membershipId), eq(memberships.salonId, salonId)))
    .returning({ id: memberships.id });
  return !!row;
}
