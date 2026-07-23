import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { handleRoute } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { sendDueReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

/** Constant-time string compare — avoids leaking the secret via response timing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * GET /api/cron/reminders — polled by Vercel Cron (see vercel.json) to send
 * appointment reminder emails via n8n. Not a Clerk-authenticated route (the
 * scheduler carries no session) — protected by a shared secret instead.
 *
 * Set CRON_SECRET in the environment and configure Vercel Cron (or whatever
 * calls this) to send `Authorization: Bearer <CRON_SECRET>`. Without
 * CRON_SECRET set, the route runs unprotected — fine for local development,
 * not for production.
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    await checkRateLimit(`cron-reminders:${getClientIp(request)}`, 10, 60);

    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = request.headers.get("authorization") ?? "";
      if (!safeEqual(auth, `Bearer ${secret}`)) {
        throw ApiError.unauthorized("Invalid or missing cron secret.");
      }
    } else {
      console.warn(
        "[cron/reminders] CRON_SECRET is not set — this endpoint is unprotected."
      );
    }

    const result = await sendDueReminders();
    return { success: true, ...result };
  });
}
