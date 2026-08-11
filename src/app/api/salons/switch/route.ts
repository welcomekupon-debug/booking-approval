import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { handleRoute } from "@/lib/api";
import {
  ACTIVE_SALON_COOKIE,
  getOrCreateUser,
  getUserMemberships,
} from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import { zUuid } from "@/lib/validators/booking";

const switchSalonSchema = z.strictObject({ salonId: zUuid });

/**
 * POST /api/salons/switch — change which business you're viewing. The
 * salonId is only ever trusted after checking it against a real membership
 * row for this user — never taken on faith from the client (same rule the
 * rest of tenant resolution follows, see auth/context.ts).
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await getOrCreateUser();
    if (!user) throw ApiError.unauthorized();

    const { salonId } = switchSalonSchema.parse(await request.json());

    const memberships = await getUserMemberships(user.id);
    const match = memberships.find((m) => m.salon.id === salonId);
    if (!match) {
      throw ApiError.forbidden("You don't have access to that business.");
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_SALON_COOKIE, salonId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return { salonId, salonName: match.salon.name };
  });
}
