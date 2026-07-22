import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { memberships, notifications } from "@/lib/db/schema";
import type { NewNotification, Notification } from "@/lib/db/types";

export async function listNotifications(
  salonId: string,
  userId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<{ items: Notification[]; unread: number }> {
  const limit = Math.min(opts.limit ?? 30, 100);

  const [items, [{ unread }]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.salonId, salonId),
          eq(notifications.userId, userId)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(opts.offset ?? 0),
    db
      .select({ unread: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.salonId, salonId),
          eq(notifications.userId, userId),
          isNull(notifications.readAt)
        )
      ),
  ]);

  return { items, unread: Number(unread) };
}

export async function markAllRead(
  salonId: string,
  userId: string
): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.salonId, salonId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    );
}

export async function markRead(
  salonId: string,
  userId: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.salonId, salonId),
        eq(notifications.userId, userId),
        inArray(notifications.id, ids)
      )
    );
}

/**
 * Fan a notification out to every member of the salon (e.g. new booking
 * request). One insert with N rows — not N inserts.
 */
export async function notifySalonMembers(
  tx: DbOrTx,
  salonId: string,
  data: Omit<NewNotification, "salonId" | "userId">
): Promise<void> {
  const members = await tx
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.salonId, salonId));

  if (members.length === 0) return;

  await tx.insert(notifications).values(
    members.map((m) => ({
      ...data,
      salonId,
      userId: m.userId,
    }))
  );
}
