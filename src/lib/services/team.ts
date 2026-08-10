import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invitations, salons } from "@/lib/db/schema";
import { ROLE_RANK, type TenantContext } from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import type { Invitation, Membership, MembershipRole, User } from "@/lib/db/types";
import {
  createInvitation,
  listInvitations,
  markInvitationAccepted,
  revokeInvitation as revokeInvitationRow,
} from "@/lib/repositories/invitations";
import {
  countOwners,
  createMembership,
  deleteMembership,
  getMembership,
  listMembers,
  updateMemberRole,
} from "@/lib/repositories/memberships";
import { recordAudit } from "@/lib/repositories/audit";
import { emailService, toEmailSalonInfo } from "@/lib/services/email";
import { appBaseUrl } from "@/lib/services/manageToken";

/**
 * Team management — invites, role changes, removals. Access control (who's
 * even allowed to call these) is enforced by `requireRole` at the API route;
 * this layer enforces the domain rules that don't reduce to a single role
 * check: you can never grant or touch a role above your own, and a salon
 * must always keep at least one owner.
 */

export async function listTeam(ctx: TenantContext): Promise<{
  members: { membership: Membership; user: User }[];
  invitations: Invitation[];
}> {
  const [members, invites] = await Promise.all([
    listMembers(ctx.salon.id),
    listInvitations(ctx.salon.id),
  ]);
  return {
    members,
    invitations: invites.filter((i) => i.status !== "accepted"),
  };
}

export async function inviteMember(
  ctx: TenantContext,
  email: string,
  role: MembershipRole
): Promise<Invitation> {
  const normalized = email.trim().toLowerCase();

  if (ROLE_RANK[role] > ROLE_RANK[ctx.role]) {
    throw ApiError.forbidden("You can't invite someone to a role higher than your own.");
  }

  const members = await listMembers(ctx.salon.id);
  if (members.some((m) => m.user.email.toLowerCase() === normalized)) {
    throw ApiError.conflict("That person is already on your team.");
  }

  const invitation = await createInvitation(db, {
    salonId: ctx.salon.id,
    email: normalized,
    role,
    invitedByUserId: ctx.user.id,
  });

  await recordAudit(db, {
    salonId: ctx.salon.id,
    actorType: "user",
    actorUserId: ctx.user.id,
    action: "team.invited",
    entityType: "invitation",
    entityId: invitation.id,
    changes: { email: normalized, role },
  });

  await emailService.sendTeamInvite({
    salon: toEmailSalonInfo(ctx.salon),
    invite: {
      email: normalized,
      role,
      invitedByName: ctx.user.name ?? ctx.user.email,
      acceptUrl: `${appBaseUrl()}/invite/${invitation.token}`,
      expiresAt: invitation.expiresAt.toISOString(),
    },
  });

  return invitation;
}

export async function revokeInvite(
  ctx: TenantContext,
  invitationId: string
): Promise<void> {
  const ok = await revokeInvitationRow(ctx.salon.id, invitationId);
  if (!ok) throw ApiError.notFound("Invite not found, or already used.");

  await recordAudit(db, {
    salonId: ctx.salon.id,
    actorType: "user",
    actorUserId: ctx.user.id,
    action: "team.invite_revoked",
    entityType: "invitation",
    entityId: invitationId,
  });
}

export async function removeMember(
  ctx: TenantContext,
  membershipId: string
): Promise<void> {
  const target = await getMembership(ctx.salon.id, membershipId);
  if (!target) throw ApiError.notFound("Team member not found.");

  if (ROLE_RANK[ctx.role] < ROLE_RANK[target.role]) {
    throw ApiError.forbidden("You can't remove someone with a higher role than you.");
  }

  if (target.role === "owner") {
    const owners = await countOwners(db, ctx.salon.id);
    if (owners <= 1) {
      throw ApiError.badRequest("Every salon needs at least one owner — promote someone else first.");
    }
  }

  await deleteMembership(ctx.salon.id, membershipId);

  await recordAudit(db, {
    salonId: ctx.salon.id,
    actorType: "user",
    actorUserId: ctx.user.id,
    action: "team.removed",
    entityType: "membership",
    entityId: membershipId,
    changes: { removedRole: target.role },
  });
}

export async function changeMemberRole(
  ctx: TenantContext,
  membershipId: string,
  newRole: MembershipRole
): Promise<Membership> {
  const target = await getMembership(ctx.salon.id, membershipId);
  if (!target) throw ApiError.notFound("Team member not found.");

  if (ROLE_RANK[ctx.role] < ROLE_RANK[target.role]) {
    throw ApiError.forbidden("You can't change the role of someone above you.");
  }
  if (ROLE_RANK[newRole] > ROLE_RANK[ctx.role]) {
    throw ApiError.forbidden("You can't grant a role higher than your own.");
  }

  if (target.role === "owner" && newRole !== "owner") {
    const owners = await countOwners(db, ctx.salon.id);
    if (owners <= 1) {
      throw ApiError.badRequest("Every salon needs at least one owner — promote someone else first.");
    }
  }

  const updated = await updateMemberRole(ctx.salon.id, membershipId, newRole);
  if (!updated) throw ApiError.notFound("Team member not found.");

  await recordAudit(db, {
    salonId: ctx.salon.id,
    actorType: "user",
    actorUserId: ctx.user.id,
    action: "team.role_changed",
    entityType: "membership",
    entityId: membershipId,
    changes: { from: target.role, to: newRole },
  });

  return updated;
}

/**
 * Claim an invite. Requires the signed-in user's verified email to match the
 * invite exactly — the token alone isn't treated as sufficient proof, since
 * links can end up forwarded or leaked in a way an email address can't.
 */
export async function acceptInvite(
  token: string,
  user: User
): Promise<{ salonId: string; salonSlug: string; role: MembershipRole }> {
  return db.transaction(async (tx) => {
    const invite = await tx.query.invitations.findFirst({
      where: eq(invitations.token, token),
    });
    if (!invite) throw ApiError.notFound("This invite link isn't valid.");

    if (invite.status !== "pending") {
      throw ApiError.conflict("This invite has already been used or revoked.");
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      await tx
        .update(invitations)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(invitations.id, invite.id));
      throw ApiError.conflict("This invite has expired — ask for a new one.");
    }
    if (invite.email !== user.email.trim().toLowerCase()) {
      throw ApiError.forbidden(
        `This invite was sent to ${invite.email}. Sign in with that email to accept it.`
      );
    }

    const salon = await tx.query.salons.findFirst({
      where: eq(salons.id, invite.salonId),
    });
    if (!salon || salon.deletedAt !== null) {
      throw ApiError.notFound("This salon no longer exists.");
    }

    const membership = await createMembership(tx, {
      userId: user.id,
      salonId: invite.salonId,
      role: invite.role,
    });
    await markInvitationAccepted(tx, invite.id, user.id);

    await recordAudit(tx, {
      salonId: invite.salonId,
      actorType: "user",
      actorUserId: user.id,
      action: "team.joined",
      entityType: "membership",
      entityId: membership.id,
      changes: { role: membership.role, viaInvitation: invite.id },
    });

    return { salonId: salon.id, salonSlug: salon.slug, role: membership.role };
  });
}
