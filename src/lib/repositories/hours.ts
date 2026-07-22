import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blockedTimes,
  businessHours,
  staffWorkingHours,
} from "@/lib/db/schema";
import type {
  BlockedTime,
  BusinessHour,
  NewBlockedTime,
  StaffWorkingHour,
} from "@/lib/db/types";

// ── Business hours (salon weekly windows, local wall-clock) ─────────────────

export async function listBusinessHours(
  salonId: string
): Promise<BusinessHour[]> {
  return db
    .select()
    .from(businessHours)
    .where(eq(businessHours.salonId, salonId))
    .orderBy(asc(businessHours.weekday), asc(businessHours.opensAt));
}

/** Replace the full weekly schedule atomically. */
export async function replaceBusinessHours(
  salonId: string,
  windows: { weekday: number; opensAt: string; closesAt: string }[]
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(businessHours).where(eq(businessHours.salonId, salonId));
    if (windows.length > 0) {
      await tx
        .insert(businessHours)
        .values(windows.map((w) => ({ ...w, salonId })));
    }
  });
}

// ── Staff working hours ─────────────────────────────────────────────────────

export async function listStaffWorkingHours(
  salonId: string,
  staffId?: string
): Promise<StaffWorkingHour[]> {
  const conditions = [eq(staffWorkingHours.salonId, salonId)];
  if (staffId) conditions.push(eq(staffWorkingHours.staffId, staffId));

  return db
    .select()
    .from(staffWorkingHours)
    .where(and(...conditions))
    .orderBy(asc(staffWorkingHours.weekday), asc(staffWorkingHours.startsAt));
}

export async function replaceStaffWorkingHours(
  salonId: string,
  staffId: string,
  windows: { weekday: number; startsAt: string; endsAt: string }[]
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(staffWorkingHours)
      .where(
        and(
          eq(staffWorkingHours.salonId, salonId),
          eq(staffWorkingHours.staffId, staffId)
        )
      );
    if (windows.length > 0) {
      await tx
        .insert(staffWorkingHours)
        .values(windows.map((w) => ({ ...w, salonId, staffId })));
    }
  });
}

// ── Blocked times (holidays, breaks, closures — UTC ranges) ─────────────────

export async function listBlockedTimes(
  salonId: string,
  range?: { from: Date; to: Date }
): Promise<BlockedTime[]> {
  const conditions = [eq(blockedTimes.salonId, salonId)];
  if (range) {
    conditions.push(
      lt(blockedTimes.startsAt, range.to),
      gte(blockedTimes.endsAt, range.from)
    );
  }
  return db
    .select()
    .from(blockedTimes)
    .where(and(...conditions))
    .orderBy(asc(blockedTimes.startsAt));
}

export async function createBlockedTime(
  data: NewBlockedTime
): Promise<BlockedTime> {
  const [row] = await db.insert(blockedTimes).values(data).returning();
  return row;
}

export async function deleteBlockedTime(
  salonId: string,
  id: string
): Promise<boolean> {
  const rows = await db
    .delete(blockedTimes)
    .where(and(eq(blockedTimes.id, id), eq(blockedTimes.salonId, salonId)))
    .returning({ id: blockedTimes.id });
  return rows.length > 0;
}
