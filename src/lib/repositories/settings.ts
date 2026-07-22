import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import type { Settings } from "@/lib/db/types";

/** Settings are 1:1 with salon and auto-created; this guarantees a row. */
export async function getSettings(salonId: string): Promise<Settings> {
  const existing = await db.query.settings.findFirst({
    where: eq(settings.salonId, salonId),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(settings)
    .values({ salonId })
    .onConflictDoNothing({ target: settings.salonId })
    .returning();

  if (created) return created;

  // Row appeared concurrently
  const raced = await db.query.settings.findFirst({
    where: eq(settings.salonId, salonId),
  });
  if (!raced) throw new Error("Failed to create settings row");
  return raced;
}

export async function updateSettings(
  salonId: string,
  patch: Partial<Omit<Settings, "id" | "salonId" | "createdAt" | "updatedAt">>
): Promise<Settings> {
  await getSettings(salonId); // ensure row exists
  const [row] = await db
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.salonId, salonId))
    .returning();
  return row;
}
