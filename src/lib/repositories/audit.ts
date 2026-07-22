import { and, desc, eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import type { AuditLog } from "@/lib/db/types";

export interface AuditEntry {
  salonId: string;
  actorType: "user" | "api_key" | "system";
  actorUserId?: string | null;
  actorApiKeyId?: string | null;
  /** e.g. "appointment.confirmed", "service.updated" */
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: unknown;
}

/** Append-only. Accepts a transaction so audit rows commit with the change. */
export async function recordAudit(
  tx: DbOrTx,
  entry: AuditEntry
): Promise<void> {
  await tx.insert(auditLogs).values({
    salonId: entry.salonId,
    actorType: entry.actorType,
    actorUserId: entry.actorUserId ?? null,
    actorApiKeyId: entry.actorApiKeyId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    changes: entry.changes ?? null,
  });
}

export async function listAuditLogs(
  salonId: string,
  opts: { limit?: number; offset?: number; entityType?: string } = {}
): Promise<AuditLog[]> {
  const conditions = [eq(auditLogs.salonId, salonId)];
  if (opts.entityType) {
    conditions.push(eq(auditLogs.entityType, opts.entityType));
  }

  return db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(opts.limit ?? 50, 200))
    .offset(opts.offset ?? 0);
}
