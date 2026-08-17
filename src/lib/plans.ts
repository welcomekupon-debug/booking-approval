import type { FixedPlan } from "@/lib/entitlements";

/**
 * Marketing copy for the three fixed subscription tiers, shown in Settings →
 * Subscription & billing and the /admin plan picker. "Custom" isn't listed
 * here — it has no fixed feature list, see src/lib/entitlements.ts for what
 * it actually resolves to per salon.
 *
 * There's no billing provider wired up yet — the platform admin sets a
 * salon's plan by hand until self-serve checkout exists. Keep this in sync
 * with the marketing pricing page.
 */
export interface PlanDetails {
  id: FixedPlan;
  label: string;
  priceMonthly: number;
  tagline: string;
  features: string[];
}

export const PLAN_ORDER: FixedPlan[] = ["starter", "professional", "business"];

export const PLAN_DETAILS: Record<FixedPlan, PlanDetails> = {
  starter: {
    id: "starter",
    label: "Starter",
    priceMonthly: 19,
    tagline: "For a single stylist or a small studio just getting off spreadsheets.",
    features: [
      "Branded booking page with your logo and brand colour",
      "Live availability — customers book real open slots",
      "Multi-service bookings in one appointment",
      "Calendar with day, week and month views",
      "1 staff member",
      "Service catalog with pricing, duration and buffers",
      "Automatic confirmation and decline emails",
      "Customer list",
    ],
  },
  professional: {
    id: "professional",
    label: "Professional",
    priceMonthly: 45,
    tagline: "For salons with a small team who need reporting and fewer no-shows.",
    features: [
      "Everything in Starter",
      "Up to 5 staff, each with their own calendar colour",
      "Colour-coded calendar by service",
      "Automatic reminder emails before appointments",
      "Self-service reschedule and cancel links for customers",
      "Reschedule and cancel request approval workflow",
      "Customer profiles with tags, VIP status and notes",
      "Analytics dashboard — revenue, trends, peak hours",
      "CSV export for reports and monthly summaries",
    ],
  },
  business: {
    id: "business",
    label: "Business",
    priceMonthly: 89,
    tagline: "For multi-chair salons that need a real team account.",
    features: [
      "Everything in Professional",
      "Unlimited staff",
      "Team accounts with owner, manager, receptionist and stylist roles",
      "API key access for automations (n8n, Zapier-style webhooks)",
      "Business hours, holidays and blocked time across the whole team",
      "Priority support",
    ],
  },
};
