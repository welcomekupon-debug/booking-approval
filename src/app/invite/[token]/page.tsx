import type { Metadata } from "next";
import { getInvitationPreview } from "@/lib/repositories/invitations";
import { getSalonById } from "@/lib/repositories/salons";
import { roleLabel } from "@/lib/roleLabels";
import { InviteAcceptFlow } from "@/components/public/InviteAcceptFlow";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "You're invited — Bookline" };
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const preview = await getInvitationPreview(token);

  if (!preview) {
    return (
      <InviteAcceptFlow
        token={token}
        status="not_found"
        salonName={null}
        invitedByName={null}
        email={null}
        roleLabel={null}
      />
    );
  }

  const salon = await getSalonById(preview.invitation.salonId);
  const expired = preview.invitation.expiresAt.getTime() < Date.now();
  const status =
    expired && preview.invitation.status === "pending"
      ? "expired"
      : preview.invitation.status;

  return (
    <InviteAcceptFlow
      token={token}
      status={status}
      salonName={preview.salonName}
      invitedByName={preview.invitedByName}
      email={preview.invitation.email}
      roleLabel={roleLabel(preview.invitation.role, salon?.category ?? "salon")}
    />
  );
}
