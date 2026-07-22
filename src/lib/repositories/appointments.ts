import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import {
  appointments,
  appointmentServices,
  customers,
  staff,
} from "@/lib/db/schema";
import type {
  Appointment,
  AppointmentDetail,
  AppointmentStatus,
  NewAppointment,
  NewAppointmentService,
} from "@/lib/db/types";

export interface AppointmentListOptions {
  status?: AppointmentStatus | AppointmentStatus[];
  from?: Date;
  to?: Date;
  staffId?: string;
  customerId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
}

function buildConditions(salonId: string, opts: AppointmentListOptions) {
  const conditions = [eq(appointments.salonId, salonId)];

  if (opts.status) {
    conditions.push(
      Array.isArray(opts.status)
        ? inArray(appointments.status, opts.status)
        : eq(appointments.status, opts.status)
    );
  }
  if (opts.from) conditions.push(gte(appointments.startsAt, opts.from));
  if (opts.to) conditions.push(lt(appointments.startsAt, opts.to));
  if (opts.staffId) conditions.push(eq(appointments.staffId, opts.staffId));
  if (opts.customerId)
    conditions.push(eq(appointments.customerId, opts.customerId));

  return and(...conditions);
}

/**
 * Paginated appointment list with customer + staff + line items.
 * Line items are fetched in ONE extra query (no N+1).
 */
export async function listAppointments(
  salonId: string,
  opts: AppointmentListOptions = {}
): Promise<{ items: AppointmentDetail[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  let where = buildConditions(salonId, opts);

  if (opts.search?.trim()) {
    const q = `%${opts.search.trim()}%`;
    where = and(
      where,
      or(
        sql`${customers.name} ILIKE ${q}`,
        sql`${customers.email} ILIKE ${q}`,
        sql`${customers.phone} ILIKE ${q}`,
        sql`${appointments.internalNote} ILIKE ${q}`,
        sql`${appointments.customerNote} ILIKE ${q}`
      )
    );
  }

  const orderCol =
    opts.order === "desc"
      ? desc(appointments.startsAt)
      : asc(appointments.startsAt);

  const base = db
    .select({
      appointment: appointments,
      customer: customers,
      staffMember: staff,
    })
    .from(appointments)
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .leftJoin(staff, eq(appointments.staffId, staff.id))
    .where(where);

  const countQuery = db
    .select({ total: count() })
    .from(appointments)
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .where(where);

  const [rows, [{ total }]] = await Promise.all([
    base.orderBy(orderCol).limit(limit).offset(offset),
    countQuery,
  ]);

  // Batch-load line items for the page (single query — no N+1)
  const ids = rows.map((r) => r.appointment.id);
  const lines = ids.length
    ? await db
        .select()
        .from(appointmentServices)
        .where(inArray(appointmentServices.appointmentId, ids))
        .orderBy(asc(appointmentServices.sortOrder))
    : [];

  const linesByAppointment = new Map<string, typeof lines>();
  for (const line of lines) {
    const list = linesByAppointment.get(line.appointmentId);
    if (list) list.push(line);
    else linesByAppointment.set(line.appointmentId, [line]);
  }

  return {
    items: rows.map((r) => ({
      ...r.appointment,
      customer: r.customer,
      staff: r.staffMember,
      services: linesByAppointment.get(r.appointment.id) ?? [],
    })),
    total,
  };
}

export async function getAppointmentById(
  salonId: string,
  id: string
): Promise<AppointmentDetail | null> {
  const row = await db.query.appointments.findFirst({
    where: and(eq(appointments.id, id), eq(appointments.salonId, salonId)),
    with: {
      customer: true,
      staff: true,
      services: {
        orderBy: asc(appointmentServices.sortOrder),
      },
    },
  });
  return (row as AppointmentDetail | undefined) ?? null;
}

/**
 * Overlapping appointments for conflict detection. Buffer-aware: an
 * appointment blocks [starts_at − buffer_before, ends_at + buffer_after].
 */
export async function findConflicts(
  tx: DbOrTx,
  salonId: string,
  range: { start: Date; end: Date },
  staffId?: string | null,
  excludeId?: string
): Promise<Appointment[]> {
  const blocking: AppointmentStatus[] = ["pending", "confirmed"];

  const conditions = [
    eq(appointments.salonId, salonId),
    inArray(appointments.status, blocking),
    // (start − before) < range.end AND (end + after) > range.start
    sql`(${appointments.startsAt} - make_interval(mins => ${appointments.bufferBeforeMinutes})) < ${range.end.toISOString()}`,
    sql`(${appointments.endsAt} + make_interval(mins => ${appointments.bufferAfterMinutes})) > ${range.start.toISOString()}`,
  ];
  if (staffId) conditions.push(eq(appointments.staffId, staffId));
  if (excludeId) conditions.push(sql`${appointments.id} <> ${excludeId}`);

  return tx
    .select()
    .from(appointments)
    .where(and(...conditions));
}

export async function insertAppointment(
  tx: DbOrTx,
  data: NewAppointment,
  lines: Omit<NewAppointmentService, "appointmentId" | "salonId">[]
): Promise<Appointment> {
  const [appointment] = await tx.insert(appointments).values(data).returning();

  if (lines.length > 0) {
    await tx.insert(appointmentServices).values(
      lines.map((line, i) => ({
        ...line,
        salonId: appointment.salonId,
        appointmentId: appointment.id,
        sortOrder: line.sortOrder ?? i,
      }))
    );
  }

  return appointment;
}

export async function updateAppointment(
  tx: DbOrTx,
  salonId: string,
  id: string,
  patch: Partial<NewAppointment>
): Promise<Appointment | null> {
  const [row] = await tx
    .update(appointments)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(appointments.id, id), eq(appointments.salonId, salonId)))
    .returning();
  return row ?? null;
}

/** Appointments in a UTC range for the calendar (no pagination — bounded by range). */
export async function listAppointmentsInRange(
  salonId: string,
  from: Date,
  to: Date
): Promise<AppointmentDetail[]> {
  const { items } = await listAppointments(salonId, {
    from,
    to,
    limit: 200,
    order: "asc",
  });
  return items;
}

/** Idempotency lookup for webhook-created bookings. */
export async function getByExternalRef(
  salonId: string,
  externalRef: string
): Promise<Appointment | null> {
  const row = await db.query.appointments.findFirst({
    where: and(
      eq(appointments.salonId, salonId),
      eq(appointments.externalRef, externalRef)
    ),
  });
  return row ?? null;
}

/** Status counts in one aggregate query (dashboard). */
export async function countByStatus(
  salonId: string
): Promise<Record<AppointmentStatus, number>> {
  const rows = await db
    .select({ status: appointments.status, n: count() })
    .from(appointments)
    .where(eq(appointments.salonId, salonId))
    .groupBy(appointments.status);

  const result = {
    pending: 0,
    confirmed: 0,
    declined: 0,
    cancelled: 0,
    completed: 0,
    no_show: 0,
  } as Record<AppointmentStatus, number>;

  for (const row of rows) result[row.status] = Number(row.n);
  return result;
}

/** Bookings + revenue per calendar bucket for charts, computed in SQL. */
export async function seriesByPeriod(
  salonId: string,
  opts: { unit: "day" | "month"; from: Date; to: Date; timezone: string }
): Promise<{ bucket: Date; bookings: number; revenueCents: number }[]> {
  const rows = await db
    .select({
      bucket: sql<string>`date_trunc(${opts.unit}, ${appointments.startsAt} AT TIME ZONE ${opts.timezone})`,
      bookings: count(),
      revenueCents: sql<string>`COALESCE(SUM(${appointments.priceTotalCents}) FILTER (WHERE ${appointments.status} IN ('confirmed','completed')), 0)`,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.salonId, salonId),
        gte(appointments.startsAt, opts.from),
        lte(appointments.startsAt, opts.to)
      )
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  return rows.map((r) => ({
    bucket: new Date(r.bucket),
    bookings: Number(r.bookings),
    revenueCents: Number(r.revenueCents),
  }));
}
