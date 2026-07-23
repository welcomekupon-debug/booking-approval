import { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { sendDueReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

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
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = request.headers.get("authorization");
      if (auth !== `Bearer ${secret}`) {
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
