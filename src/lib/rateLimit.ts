import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimitHits } from "@/lib/db/schema";
import { ApiError } from "@/lib/errors";

/**
 * Fixed-window rate limiting backed by Postgres — no new infra (Redis, Vercel
 * KV) required, consistent with "PostgreSQL is the source of truth". Good
 * enough for this app's traffic; not meant to withstand a distributed attack
 * (that belongs at the edge/WAF), just to stop casual abuse and runaway bots.
 *
 * One atomic UPSERT per call: if the bucket's window has expired, it resets
 * to count=1; otherwise it increments. Race-safe under concurrent requests
 * because Postgres serializes the UPSERT per row.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<void> {
  const result = await db.execute(sql`
    INSERT INTO rate_limit_hits (key, window_start, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limit_hits.window_start > now() - make_interval(secs => ${windowSeconds})
        THEN rate_limit_hits.count + 1
        ELSE 1
      END,
      window_start = CASE
        WHEN rate_limit_hits.window_start > now() - make_interval(secs => ${windowSeconds})
        THEN rate_limit_hits.window_start
        ELSE now()
      END
    RETURNING count
  `);

  const rows = result as unknown as Array<{ count: number | string }>;
  const count = Number(rows[0]?.count ?? 1);
  if (count > limit) {
    throw ApiError.tooManyRequests();
  }
}

/** Best-effort client IP from standard proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
