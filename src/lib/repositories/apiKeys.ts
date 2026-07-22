import { createHash, randomBytes } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import type { ApiKey } from "@/lib/db/types";

/**
 * API keys authenticate machine callers (n8n → public booking endpoint).
 * The raw key is shown ONCE at creation; only a SHA-256 hash is stored.
 * Key format: bk_live_<40 hex chars>
 */

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createApiKey(
  salonId: string,
  name: string
): Promise<{ record: ApiKey; rawKey: string }> {
  const rawKey = `bk_live_${randomBytes(20).toString("hex")}`;

  const [record] = await db
    .insert(apiKeys)
    .values({
      salonId,
      name,
      keyHash: hashKey(rawKey),
      prefix: rawKey.slice(0, 12),
    })
    .returning();

  return { record, rawKey };
}

/** Resolve a presented key to its salon. Returns null for unknown/revoked. */
export async function verifyApiKey(
  rawKey: string
): Promise<{ salonId: string; apiKeyId: string } | null> {
  if (!rawKey.startsWith("bk_")) return null;

  const row = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.keyHash, hashKey(rawKey)), isNull(apiKeys.revokedAt)),
  });
  if (!row) return null;

  // Fire-and-forget usage stamp
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .then(
      () => undefined,
      () => undefined
    );

  return { salonId: row.salonId, apiKeyId: row.id };
}

export async function listApiKeys(salonId: string): Promise<ApiKey[]> {
  return db.select().from(apiKeys).where(eq(apiKeys.salonId, salonId));
}

export async function revokeApiKey(
  salonId: string,
  id: string
): Promise<boolean> {
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.salonId, salonId)))
    .returning({ id: apiKeys.id });
  return !!row;
}
