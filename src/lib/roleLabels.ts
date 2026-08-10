import type { BusinessCategory, MembershipRole } from "@/lib/db/types";

/**
 * Display labels only — the underlying `membership_role` values
 * (owner/manager/stylist/receptionist) never change. This is what makes the
 * same four-role system work across salons, gyms, clinics, and studios
 * without a schema migration every time a new vertical is added: teach this
 * file a new category, not the database.
 */

const ROLE_LABELS: Record<BusinessCategory, Record<MembershipRole, string>> = {
  salon: {
    owner: "Owner",
    manager: "Manager",
    stylist: "Stylist",
    receptionist: "Front desk",
  },
  fitness: {
    owner: "Owner",
    manager: "Manager",
    stylist: "Trainer",
    receptionist: "Front desk",
  },
  medical: {
    owner: "Owner",
    manager: "Manager",
    stylist: "Provider",
    receptionist: "Front desk",
  },
  consulting: {
    owner: "Owner",
    manager: "Manager",
    stylist: "Consultant",
    receptionist: "Coordinator",
  },
  other: {
    owner: "Owner",
    manager: "Manager",
    stylist: "Team member",
    receptionist: "Front desk",
  },
};

export const BUSINESS_CATEGORY_LABELS: Record<BusinessCategory, string> = {
  salon: "Salon / spa / barbershop",
  fitness: "Gym / fitness studio",
  medical: "Clinic / medical / wellness",
  consulting: "Consulting / coaching / tutoring",
  other: "Other",
};

export const BUSINESS_CATEGORIES = Object.keys(
  BUSINESS_CATEGORY_LABELS
) as BusinessCategory[];

export const MEMBERSHIP_ROLES: MembershipRole[] = [
  "owner",
  "manager",
  "stylist",
  "receptionist",
];

/** Friendly label for a role, personalized to the salon's business category. */
export function roleLabel(
  role: MembershipRole,
  category: BusinessCategory = "salon"
): string {
  return ROLE_LABELS[category]?.[role] ?? ROLE_LABELS.salon[role];
}

/** Every role's label for a given category — for pickers/legends. */
export function roleLabelsFor(
  category: BusinessCategory = "salon"
): Record<MembershipRole, string> {
  return ROLE_LABELS[category] ?? ROLE_LABELS.salon;
}
