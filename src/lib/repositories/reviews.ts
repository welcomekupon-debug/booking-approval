import { and, avg, count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, reviews, staff } from "@/lib/db/schema";
import type { NewReview, Review } from "@/lib/db/types";

export interface ReviewRow {
  review: Review;
  customerName: string;
  staffName: string | null;
}

/** Reviews for a salon, newest first — optionally scoped to one staff member. */
export async function listReviews(
  salonId: string,
  opts: { staffId?: string } = {}
): Promise<ReviewRow[]> {
  const conditions = [eq(reviews.salonId, salonId)];
  if (opts.staffId) conditions.push(eq(reviews.staffId, opts.staffId));

  const rows = await db
    .select({
      review: reviews,
      customerName: customers.name,
      staffName: staff.name,
    })
    .from(reviews)
    .innerJoin(customers, eq(reviews.customerId, customers.id))
    .leftJoin(staff, eq(reviews.staffId, staff.id))
    .where(and(...conditions))
    .orderBy(desc(reviews.createdAt));

  return rows;
}

export async function getReviewByAppointmentId(
  appointmentId: string
): Promise<Review | null> {
  const row = await db.query.reviews.findFirst({
    where: eq(reviews.appointmentId, appointmentId),
  });
  return row ?? null;
}

export async function createReview(data: NewReview): Promise<Review> {
  const [row] = await db.insert(reviews).values(data).returning();
  return row;
}

export interface StaffRatingSummary {
  staffId: string | null;
  staffName: string | null;
  avgRating: number;
  count: number;
}

/** Average rating + review count per staff member, for the manager-facing summary. */
export async function staffRatingSummary(
  salonId: string
): Promise<StaffRatingSummary[]> {
  const rows = await db
    .select({
      staffId: reviews.staffId,
      staffName: staff.name,
      avgRating: avg(reviews.rating),
      count: count(),
    })
    .from(reviews)
    .leftJoin(staff, eq(reviews.staffId, staff.id))
    .where(eq(reviews.salonId, salonId))
    .groupBy(reviews.staffId, staff.name);

  return rows.map((r) => ({
    staffId: r.staffId,
    staffName: r.staffName,
    avgRating: r.avgRating ? Math.round(Number(r.avgRating) * 10) / 10 : 0,
    count: Number(r.count),
  }));
}
