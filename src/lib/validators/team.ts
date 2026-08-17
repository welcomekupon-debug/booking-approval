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

/** PATCH /api/team/[membershipId]/staff */
export const linkStaffSchema = z.strictObject({
  staffId: zUuid.nullable(),
});

/** POST /api/admin/impersonate */
export const impersonateSchema = z.strictObject({
  salonId: zUuid,
});

/** PATCH /api/admin/salons/[id] */
export const updateSalonPlanSchema = z
  .strictObject({
    plan: z.enum(["starter", "professional", "business", "custom"]).optional(),
    customEntitlements: z
      .strictObject({
        maxStaff: z.number().int().min(1).max(999).nullable(),
        analytics: z.boolean(),
        selfServiceBooking: z.boolean(),
        apiAccess: z.boolean(),
      })
      .optional(),
  })
  .refine((v) => v.plan !== undefined || v.customEntitlements !== undefined, {
    message: "Provide a plan, customEntitlements, or both.",
  });

export { zMembershipRole };
