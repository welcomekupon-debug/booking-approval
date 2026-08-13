import { randomBytes } from "crypto";
import { and, eq, ne } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { invitations, salons, users } from "@/lib/db/schema";
import type { Invitation, MembershipRole } from "@/lib/db/types";

const INVITE_TTL_DAYS = 7;

function generateToken(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Create a pending invite. Any existing pending invite for the same email at
 * this salon is revoked first — one live invite per person, re-inviting just
 * issues a fresh link.
 */
export async function createInvitation(
  tx: DbOrTx,
  params: {
    salonId: string;
    email: string;
    role: MembershipRole;
    invitedByUserId: string;
  }
): Promise<Invitation> {
  const email = params.email.trim().toLowerCase();

  await tx
    .update(invitations)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(
      and(
        eq(invitations.salonId, params.salonId),
        eq(invitations.email, email),
        eq(invitations.status, "pending")
      )
    );

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 3600_000);

  const [row] = await tx
    .insert(invitations)
    .values({
      salonId: params.salonId,
      email,
      role: params.role,
      token: generateToken(),
      invitedByUserId: params.invitedByUserId,
      expiresAt,
    })
    .returning();

  return row;
}

export async function listInvitations(
  salonId: string
): Promise<Invitation[]> {
  return db
    .select()
    .from(invitations)
    .where(eq(invitations.salonId, salonId))
    .orderBy(invitations.createdAt);
}

export async function findInvitationByToken(
  token: string
): Promise<Invitation | null> {
  const row = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  });
  return row ?? null;
}

/** Public-safe preview for the accept-invite landing page. */
export async function getInvitationPreview(token: string): Promise<{
  invitation: Invitation;
  salonName: string;
  invitedByName: string | null;
} | null> {
  const row = await db
    .select({
      invitation: invitations,
      salonName: salons.name,
      invitedByName: users.name,
    })
    .from(invitations)
    .innerJoin(salons, eq(invitations.salonId, salons.id))
    .leftJoin(users, eq(invitations.invitedByUserId, users.id))
    .where(eq(invitations.token, token))
    .limit(1);

  if (row.length === 0) return null;
  return row[0];
}

export async function markInvitationAccepted(
  tx: DbOrTx,
  invitationId: string,
  acceptedByUserId: string
): Promise<void> {
  await tx
    .update(invitations)
    .set({
      status: "accepted",
      acceptedByUserId,
      acceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(invitations.id, invitationId));
}

export async function revokeInvitation(
  salonId: string,
  id: string
): Promise<boolean> {
  const [row] = await db
    .update(invitations)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(
      and(
        eq(invitations.id, id),
        eq(invitations.salonId, salonId),
        eq(invitations.status, "pending")
      )
    )
    .returning({ id: invitations.id });
  return !!row;
}

/** Hard-delete a dead (already revoked/expired) invite row — never a pending one. */
export async function deleteInvitation(
  salonId: string,
  id: string
): Promise<boolean> {
  const [row] = await db
    .delete(invitations)
    .where(
      and(
        eq(invitations.id, id),
        eq(invitations.salonId, salonId),
        ne(invitations.status, "pending")
      )
    )
    .returning({ id: invitations.id });
  return !!row;
}
