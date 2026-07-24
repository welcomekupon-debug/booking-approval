import { createHmac, timingSafeEqual } from "crypto";

/**
 * Stateless "manage your booking" links. The token is an HMAC of the
 * appointment id — no extra column on `appointments`, no expiry to manage,
 * and it can't be forged without APPOINTMENT_MANAGE_SECRET. Anyone with the
 * link (i.e. the customer who received the confirmation email) can view and
 * request changes to that one appointment; nothing is ever mutated directly
 * from this token — every request still needs staff approval.
 */

function secret(): string {
  const s = process.env.APPOINTMENT_MANAGE_SECRET;
  if (!s) {
    throw new Error(
      "APPOINTMENT_MANAGE_SECRET is not set — required to sign/verify booking-manage links."
    );
  }
  return s;
}

export function signAppointmentToken(appointmentId: string): string {
  return createHmac("sha256", secret()).update(appointmentId).digest("hex");
}

export function verifyAppointmentToken(
  appointmentId: string,
  token: string
): boolean {
  if (!token) return false;
  try {
    const expected = Buffer.from(signAppointmentToken(appointmentId));
    const given = Buffer.from(token);
    if (expected.length !== given.length) return false;
    return timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}

export function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Full public URL a customer clicks from their email. Returns null (never
 * throws) if APPOINTMENT_MANAGE_SECRET isn't configured yet — a missing
 * "manage your booking" link must never break the email it's attached to,
 * let alone the booking mutation that triggered it.
 */
export function buildManageUrl(appointmentId: string): string | null {
  try {
    const token = signAppointmentToken(appointmentId);
    return `${appBaseUrl()}/manage/${appointmentId}/${token}`;
  } catch (err) {
    console.warn("[manageToken] Couldn't build manage URL:", err);
    return null;
  }
}
