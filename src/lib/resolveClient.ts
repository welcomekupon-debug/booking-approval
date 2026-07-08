import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getClientByEmail } from "@/lib/sheets";
import type { ClientProfile } from "@/types/client";

/**
 * Resolve the signed-in Clerk user to their client profile (which points at
 * their bookings spreadsheet). Returns either the profile or a ready-made
 * error response — API routes can return the latter directly.
 */
export async function resolveClient(): Promise<
  { client: ClientProfile; error: null } | { client: null; error: NextResponse }
> {
  const user = await currentUser();

  if (!user) {
    return {
      client: null,
      error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const email = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId
  )?.emailAddress;

  if (!email) {
    return {
      client: null,
      error: NextResponse.json(
        { error: "No email address found on this account." },
        { status: 400 }
      ),
    };
  }

  const client = await getClientByEmail(email);

  if (!client) {
    return {
      client: null,
      error: NextResponse.json(
        {
          error:
            "No client profile found for this account. Please contact the administrator to be added.",
        },
        { status: 404 }
      ),
    };
  }

  return { client, error: null };
}
