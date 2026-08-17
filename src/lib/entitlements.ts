import type { Salon } from "@/lib/db/types";

/**
 * What a salon is actually allowed to do, resolved from its plan. This is
 * the enforcement layer — `src/lib/plans.ts` is the marketing copy shown in
 * Settings/pricing, this is what API routes and the UI actually check.
 *
 * Kept deliberately small: only features that can be gated cleanly without
 * touching core booking/email functionality. Everything else (confirmation
 * emails, customer profiles, colour-coded calendar, team roles, business
 * hours) stays available on every plan.
 */
export interface Entitlements {
  /** Active staff members allowed. null = unlimited. */
  maxStaff: number | null;
  /** The standalone Analytics page + CSV export. */
  analytics: boolean;
  /** Customer-facing "manage your booking" reschedule/cancel links. */
  selfServiceBooking: boolean;
  /** Creating and using machine API keys (n8n, Zapier-style webhooks). */
  apiAccess: boolean;
}

/** The plans with fixed, predefined entitlements — everything but "custom". */
export type FixedPlan = "starter" | "professional" | "business";

const TIER_ENTITLEMENTS: Record<FixedPlan, Entitlements> = {
  starter: {
    maxStaff: 1,
    analytics: false,
    selfServiceBooking: false,
    apiAccess: false,
  },
  professional: {
    maxStaff: 5,
    analytics: true,
    selfServiceBooking: true,
    apiAccess: false,
  },
  business: {
    maxStaff: null,
    analytics: true,
    selfServiceBooking: true,
    apiAccess: true,
  },
};

/** Starting point shown in the admin UI the moment a salon switches to Custom. */
export const CUSTOM_PLAN_DEFAULTS: Entitlements = TIER_ENTITLEMENTS.starter;

type SalonForEntitlements = Pick<
  Salon,
  | "plan"
  | "customMaxStaff"
  | "customAnalytics"
  | "customSelfServiceBooking"
  | "customApiAccess"
>;

export function resolveEntitlements(salon: SalonForEntitlements): Entitlements {
  if (salon.plan === "custom") {
    return {
      maxStaff: salon.customMaxStaff,
      analytics: salon.customAnalytics,
      selfServiceBooking: salon.customSelfServiceBooking,
      apiAccess: salon.customApiAccess,
    };
  }
  return TIER_ENTITLEMENTS[salon.plan];
}
