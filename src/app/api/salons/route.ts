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
import { createSalonForUser } from "@/lib/repositories/salons";

const createSalonSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
});

function setActiveSalonCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, salonId: string) {
  cookieStore.set(ACTIVE_SALON_COOKIE, salonId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** GET /api/salons — every business this account has access to, for the switcher. */
export async function GET() {
  return handleRoute(async () => {
    const user = await getOrCreateUser();
    if (!user) throw ApiError.unauthorized();

    const memberships = await getUserMemberships(user.id);
    const cookieStore = await cookies();
    const preferred = cookieStore.get(ACTIVE_SALON_COOKIE)?.value;
    const activeId =
      (preferred && memberships.some((m) => m.salon.id === preferred) && preferred) ||
      memberships[0]?.salon.id ||
      null;

    return {
      salons: memberships.map((m) => ({
        id: m.salon.id,
        name: m.salon.name,
        logoUrl: m.salon.logoUrl,
        role: m.membership.role,
        current: m.salon.id === activeId,
      })),
    };
  });
}

/**
 * POST /api/salons — create an additional, fully independent business under
 * this same account (separate calendar, staff, customers, billing — nothing
 * shared with your other businesses). Switches straight into it.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await getOrCreateUser();
    if (!user) throw ApiError.unauthorized();

    const { name } = createSalonSchema.parse(await request.json());
    const salon = await createSalonForUser(user.id, { name });

    const cookieStore = await cookies();
    setActiveSalonCookie(cookieStore, salon.id);

    return { salonId: salon.id, salonName: salon.name };
  });
}
