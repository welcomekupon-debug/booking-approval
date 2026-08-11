import { z } from "zod";
import { zIsoDate, zUuid } from "./booking";

/** POST /api/reviews/send */
export const sendReviewRequestsSchema = z.strictObject({
  date: zIsoDate,
});

/** POST /api/public/review */
export const submitReviewSchema = z.strictObject({
  appointmentId: zUuid,
  token: z.string().trim().min(1).max(128),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().nullable(),
});
