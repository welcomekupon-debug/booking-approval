import { handleRoute } from "@/lib/api";
import { requireTenant } from "@/lib/auth/context";
import { listReviewsForViewer } from "@/lib/services/reviews";

/**
 * GET /api/reviews — owner/manager see every review; anyone else only sees
 * reviews tied to their own linked staff profile (see listReviewsForViewer).
 */
export async function GET() {
  return handleRoute(async () => {
    const ctx = await requireTenant();
    const { reviews, staffSummary, linked } = await listReviewsForViewer(ctx);

    return {
      linked,
      staffSummary,
      reviews: reviews.map((r) => ({
        id: r.review.id,
        rating: r.review.rating,
        comment: r.review.comment,
        customerName: r.customerName,
        staffName: r.staffName,
        createdAt: r.review.createdAt.toISOString(),
      })),
    };
  });
}
