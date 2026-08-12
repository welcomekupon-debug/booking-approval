import type { TenantContext } from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import {
  listAppointmentsForReviewRequest,
  markReviewRequested,
} from "@/lib/repositories/appointments";
import { getAppointmentByIdUnscoped } from "@/lib/repositories/changeRequests";
import {
  createReview,
  getReviewByAppointmentId,
  listReviews,
  staffRatingSummary,
  type ReviewRow,
  type StaffRatingSummary,
} from "@/lib/repositories/reviews";
import { getSalonById } from "@/lib/repositories/salons";
import { getSettings } from "@/lib/repositories/settings";
import { emailService, formatEmailDate, toEmailSalonInfo } from "@/lib/services/email";
import { buildReviewUrl, verifyAppointmentToken } from "@/lib/services/manageToken";
import { localDateTimeToUtc } from "@/lib/services/timezone";
import { ROLE_RANK } from "@/lib/auth/context";
import type { Review } from "@/lib/db/types";

/**
 * Review requests are always manually triggered by staff, one calendar day
 * at a time — never automatic. Only appointments that actually happened
 * (confirmed/completed, already over) and haven't been requested yet get an
 * email; no-shows, cancellations, and declines are silently skipped.
 */
export async function sendReviewRequestsForDay(
  ctx: TenantContext,
  dateIso: string
): Promise<{ sent: number }> {
  const settings = await getSettings(ctx.salon.id);
  if (!settings.reviewRequestsEnabled) {
    throw ApiError.badRequest(
      "Review requests are turned off for this business — enable them on the Reviews page first."
    );
  }

  const tz = ctx.salon.timezone;
  const from = localDateTimeToUtc(dateIso, "00:00", tz);
  const to = localDateTimeToUtc(dateIso, "23:59", tz);
  // Half-open range in the repo query is [from, to) — push `to` past midnight
  // so the last minute of the day is included.
  const toExclusive = new Date(to.getTime() + 60_000);

  const eligible = await listAppointmentsForReviewRequest(ctx.salon.id, {
    from,
    to: toExclusive,
  });

  const withEmail = eligible.filter((a) => !!a.customer.email);
  const salonInfo = toEmailSalonInfo(ctx.salon);

  for (const appt of withEmail) {
    const reviewUrl = buildReviewUrl(appt.id);
    if (!reviewUrl) continue; // secret not configured — skip rather than send a dead link
    await emailService.sendReviewRequest({
      salon: salonInfo,
      customer: {
        name: appt.customer.name,
        email: appt.customer.email!,
        phone: appt.customer.phone,
      },
      review: {
        date: formatEmailDate(appt.startsAt, tz),
        serviceName: appt.services.map((s) => s.serviceName).join(", ") || "your visit",
        staffName: appt.staff?.name ?? "",
        reviewUrl,
      },
    });
  }

  await markReviewRequested(
    ctx.salon.id,
    withEmail.map((a) => a.id)
  );

  return { sent: withEmail.length };
}

export interface SubmitReviewInput {
  rating: number;
  comment?: string | null;
}

/** Public, token-gated — a customer submitting feedback from the emailed link. */
export async function submitReview(
  appointmentId: string,
  token: string,
  input: SubmitReviewInput
): Promise<Review> {
  if (!verifyAppointmentToken(appointmentId, token)) {
    throw ApiError.notFound("Review link not found.");
  }

  const appointment = await getAppointmentByIdUnscoped(appointmentId);
  if (!appointment) throw ApiError.notFound("Review link not found.");

  const existing = await getReviewByAppointmentId(appointmentId);
  if (existing) throw ApiError.conflict("This visit has already been reviewed.");

  return createReview({
    salonId: appointment.salonId,
    appointmentId: appointment.id,
    customerId: appointment.customerId,
    staffId: appointment.staffId,
    rating: input.rating,
    comment: input.comment?.trim() || null,
  });
}

export interface ViewerReviews {
  reviews: ReviewRow[];
  /** Only present for owner/manager — the salon-wide staff leaderboard. */
  staffSummary: StaffRatingSummary[] | null;
  /** Whether this viewer (a stylist/receptionist) has a linked staff profile at all. */
  linked: boolean;
}

/**
 * Owner/manager see every review across the salon; anyone else only sees
 * reviews tied to their own linked staff profile (memberships.staffId) —
 * feedback is coaching, not a leaderboard for the whole team to pick apart.
 */
export async function listReviewsForViewer(ctx: TenantContext): Promise<ViewerReviews> {
  const isManager = ROLE_RANK[ctx.role] >= ROLE_RANK.manager;

  if (isManager) {
    const [rows, summary] = await Promise.all([
      listReviews(ctx.salon.id),
      staffRatingSummary(ctx.salon.id),
    ]);
    return { reviews: rows, staffSummary: summary, linked: true };
  }

  const staffId = ctx.membership?.staffId ?? null;
  if (!staffId) return { reviews: [], staffSummary: null, linked: false };

  const rows = await listReviews(ctx.salon.id, { staffId });
  return { reviews: rows, staffSummary: null, linked: true };
}

/** Data the public review page needs — resolved from the token, no tenant session. */
export async function getPublicReviewData(appointmentId: string, token: string) {
  if (!verifyAppointmentToken(appointmentId, token)) return null;

  const appointment = await getAppointmentByIdUnscoped(appointmentId);
  if (!appointment) return null;

  const [salon, existing] = await Promise.all([
    getSalonById(appointment.salonId),
    getReviewByAppointmentId(appointmentId),
  ]);
  if (!salon) return null;

  return { appointment, salon, alreadyReviewed: !!existing };
}
