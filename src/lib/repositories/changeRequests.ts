import { and, desc, eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { appointmentChangeRequests, appointments } from "@/lib/db/schema";
import type {
  AppointmentChangeRequest,
  AppointmentDetail,
  ChangeRequestType,
} from "@/lib/db/types";

/**
 * Public-page lookup — deliberately NOT salon-scoped, because the customer
 * calling this only has an appointment id + signed token, not a salon
 * session. Callers MUST verify the token (see services/manageToken.ts)
 * before trusting anything returned here.
 */
export async function getAppointmentByIdUnscoped(
  id: string
): Promise<AppointmentDetail | null> {
  const row = await db.query.appointments.findFirst({
    where: eq(appointments.id, id),
    with: {
      customer: true,
      staff: true,
      services: true,
    },
  });
  return (row as AppointmentDetail | undefined) ?? null;
}

/** Any request still awaiting staff action for this appointment. */
export async function getPendingChangeRequest(
  appointmentId: string
): Promise<AppointmentChangeRequest | null> {
  const row = await db.query.appointmentChangeRequests.findFirst({
    where: and(
      eq(appointmentChangeRequests.appointmentId, appointmentId),
      eq(appointmentChangeRequests.status, "pending")
    ),
  });
  return row ?? null;
}

export async function createChangeRequest(
  tx: DbOrTx,
  data: {
    salonId: string;
    appointmentId: string;
    type: ChangeRequestType;
    requestedStartsAt?: Date | null;
    customerNote?: string | null;
  }
): Promise<AppointmentChangeRequest> {
  const [row] = await tx
    .insert(appointmentChangeRequests)
    .values({
      salonId: data.salonId,
      appointmentId: data.appointmentId,
      type: data.type,
      requestedStartsAt: data.requestedStartsAt ?? null,
      customerNote: data.customerNote ?? null,
    })
    .returning();
  return row;
}

/** Pending requests across the salon, newest first — the staff-facing queue. */
export async function listPendingChangeRequests(
  salonId: string
): Promise<AppointmentChangeRequest[]> {
  return db
    .select()
    .from(appointmentChangeRequests)
    .where(
      and(
        eq(appointmentChangeRequests.salonId, salonId),
        eq(appointmentChangeRequests.status, "pending")
      )
    )
    .orderBy(desc(appointmentChangeRequests.createdAt));
}

export async function getChangeRequestById(
  salonId: string,
  id: string
): Promise<AppointmentChangeRequest | null> {
  const row = await db.query.appointmentChangeRequests.findFirst({
    where: and(
      eq(appointmentChangeRequests.id, id),
      eq(appointmentChangeRequests.salonId, salonId)
    ),
  });
  return row ?? null;
}

export async function resolveChangeRequest(
  tx: DbOrTx,
  salonId: string,
  id: string,
  status: "approved" | "declined",
  resolvedByUserId: string
): Promise<void> {
  await tx
    .update(appointmentChangeRequests)
    .set({ status, resolvedAt: new Date(), resolvedByUserId })
    .where(
      and(
        eq(appointmentChangeRequests.id, id),
        eq(appointmentChangeRequests.salonId, salonId)
      )
    );
}
