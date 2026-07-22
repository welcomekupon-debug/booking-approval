import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { services, staff } from "@/lib/db/schema";
import type {
  NewService,
  NewStaffMember,
  Service,
  StaffMember,
} from "@/lib/db/types";

// ── Services ────────────────────────────────────────────────────────────────

export async function listServices(
  salonId: string,
  opts: { publicOnly?: boolean; includeInactive?: boolean } = {}
): Promise<Service[]> {
  const conditions = [eq(services.salonId, salonId), isNull(services.deletedAt)];
  if (opts.publicOnly) conditions.push(eq(services.isPublic, true));
  if (!opts.includeInactive) conditions.push(eq(services.isActive, true));

  return db
    .select()
    .from(services)
    .where(and(...conditions))
    .orderBy(asc(services.sortOrder), asc(services.name));
}

export async function getServicesByIds(
  salonId: string,
  ids: string[]
): Promise<Service[]> {
  if (ids.length === 0) return [];
  const all = await listServices(salonId, { includeInactive: true });
  const byId = new Map(all.map((s) => [s.id, s]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export async function createService(
  salonId: string,
  data: Omit<NewService, "salonId">
): Promise<Service> {
  const [row] = await db
    .insert(services)
    .values({ ...data, salonId })
    .returning();
  return row;
}

export async function updateService(
  salonId: string,
  id: string,
  patch: Partial<Omit<NewService, "salonId" | "id">>
): Promise<Service | null> {
  const [row] = await db
    .update(services)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(services.id, id),
        eq(services.salonId, salonId),
        isNull(services.deletedAt)
      )
    )
    .returning();
  return row ?? null;
}

export async function softDeleteService(
  salonId: string,
  id: string
): Promise<boolean> {
  const [row] = await db
    .update(services)
    .set({ deletedAt: new Date(), isActive: false })
    .where(and(eq(services.id, id), eq(services.salonId, salonId)))
    .returning({ id: services.id });
  return !!row;
}

// ── Staff ───────────────────────────────────────────────────────────────────

export async function listStaff(
  salonId: string,
  opts: { includeInactive?: boolean } = {}
): Promise<StaffMember[]> {
  const conditions = [eq(staff.salonId, salonId), isNull(staff.deletedAt)];
  if (!opts.includeInactive) conditions.push(eq(staff.isActive, true));

  return db
    .select()
    .from(staff)
    .where(and(...conditions))
    .orderBy(asc(staff.name));
}

export async function getStaffById(
  salonId: string,
  id: string
): Promise<StaffMember | null> {
  const row = await db.query.staff.findFirst({
    where: and(
      eq(staff.id, id),
      eq(staff.salonId, salonId),
      isNull(staff.deletedAt)
    ),
  });
  return row ?? null;
}

export async function createStaff(
  salonId: string,
  data: Omit<NewStaffMember, "salonId">
): Promise<StaffMember> {
  const [row] = await db
    .insert(staff)
    .values({ ...data, salonId })
    .returning();
  return row;
}

export async function updateStaff(
  salonId: string,
  id: string,
  patch: Partial<Omit<NewStaffMember, "salonId" | "id">>
): Promise<StaffMember | null> {
  const [row] = await db
    .update(staff)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(eq(staff.id, id), eq(staff.salonId, salonId), isNull(staff.deletedAt))
    )
    .returning();
  return row ?? null;
}

export async function softDeleteStaff(
  salonId: string,
  id: string
): Promise<boolean> {
  const [row] = await db
    .update(staff)
    .set({ deletedAt: new Date(), isActive: false })
    .where(and(eq(staff.id, id), eq(staff.salonId, salonId)))
    .returning({ id: staff.id });
  return !!row;
}
