import { z } from "zod";
import { zUuid } from "@/lib/validators/booking";

const zMembershipRole = z.enum(["owner", "manager", "stylist", "receptionist"]);

/** POST /api/team/invite */
export const inviteMemberSchema = z.strictObject({
  email: z.string().trim().email().max(320),
  role: zMembershipRole,
});

/** PATCH /api/team/[membershipId] */
export const changeMemberRoleSchema = z.strictObject({
  role: zMembershipRole,
});

/** POST /api/admin/impersonate */
export const impersonateSchema = z.strictObject({
  salonId: zUuid,
});

export { zMembershipRole };
