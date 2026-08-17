import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAppointmentByIdUnscoped, getPendingChangeRequest } from "@/lib/repositories/changeRequests";
import { getSalonById } from "@/lib/repositories/salons";
import { getSettings } from "@/lib/repositories/settings";
import { verifyAppointmentToken } from "@/lib/services/manageToken";
import { resolveEntitlements } from "@/lib/entitlements";
import { ManageBookingFlow } from "@/components/public/ManageBookingFlow";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; token: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Manage your booking" };
}

/** Public "manage your booking" page — token-gated, no Clerk session. */
export default async function ManageBookingPage({ params }: Props) {
  const { id, token } = await params;

  if (!verifyAppointmentToken(id, token)) notFound();

  const appointment = await getAppointmentByIdUnscoped(id);
  if (!appointment) notFound();

  const [salon, settings, pending] = await Promise.all([
    getSalonById(appointment.salonId),
    getSettings(appointment.salonId),
    getPendingChangeRequest(id),
  ]);
  if (!salon) notFound();

  return (
    <ManageBookingFlow
      appointmentId={appointment.id}
      token={token}
      appointment={{
        status: appointment.status,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        serviceNames: appointment.services.map((s) => s.serviceName),
        serviceIds: appointment.services
          .map((s) => s.serviceId)
          .filter((v): v is string => !!v),
        staffId: appointment.staffId,
        staffName: appointment.staff?.name ?? null,
      }}
      salon={{
        slug: salon.slug,
        name: salon.name,
        logoUrl: salon.logoUrl,
        timezone: salon.timezone,
        allowCancellation: settings.allowCancellation,
        selfServiceEnabled: resolveEntitlements(salon).selfServiceBooking,
      }}
      pendingRequest={
        pending
          ? { type: pending.type, createdAt: pending.createdAt.toISOString() }
          : null
      }
    />
  );
}
