import { db } from "@/lib/db";
import type { Service } from "@/lib/db/types";
import type { TenantContext } from "@/lib/auth/context";
import { ApiError } from "@/lib/errors";
import { getServicesByIds, updateService } from "@/lib/repositories/catalog";
import { recordAudit } from "@/lib/repositories/audit";
import { localDateTimeToUtc } from "@/lib/services/timezone";

/**
 * Promotion pricing — a service carries at most one scheduled promo at a
 * time (promoStartsAt/promoEndsAt window). Whether it's live is computed
 * from the current time rather than a flag, so nothing needs a cron job to
 * turn it off; it just stops applying once `now` passes `promoEndsAt`.
 */

export function isPromoActive(
  service: Pick<Service, "promoType" | "promoValue" | "promoStartsAt" | "promoEndsAt">,
  now: Date = new Date()
): boolean {
  return !!(
    service.promoType &&
    service.promoValue != null &&
    service.promoStartsAt &&
    service.promoEndsAt &&
    now >= service.promoStartsAt &&
    now <= service.promoEndsAt
  );
}

/** Whether the promo is set but hasn't started yet ("scheduled"). */
export function isPromoScheduled(
  service: Pick<Service, "promoType" | "promoValue" | "promoStartsAt" | "promoEndsAt">,
  now: Date = new Date()
): boolean {
  return !!(
    service.promoType &&
    service.promoValue != null &&
    service.promoStartsAt &&
    service.promoEndsAt &&
    now < service.promoStartsAt
  );
}

/** The price to actually charge right now — promo price if one is live, otherwise the base price. */
export function effectivePriceCents(
  service: Pick<Service, "priceCents" | "promoType" | "promoValue" | "promoStartsAt" | "promoEndsAt">,
  now: Date = new Date()
): number {
  if (!isPromoActive(service, now)) return service.priceCents;
  if (service.promoType === "percent") {
    return Math.max(
      0,
      Math.round(service.priceCents * (1 - service.promoValue! / 100))
    );
  }
  // "fixed" — promoValue is the flat promo price in cents, capped at the base price
  return Math.max(0, Math.min(service.priceCents, service.promoValue!));
}

interface Actor {
  type: "user" | "api_key" | "system";
  userId?: string;
}

export interface StartPromoInput {
  label?: string | null;
  type: "percent" | "fixed";
  value: number;
  /** Local calendar dates, "YYYY-MM-DD" — inclusive, in the salon's timezone. */
  startsAt: string;
  endsAt: string;
}

/**
 * Schedule (or replace) the one promotion a service can have at a time.
 * Setting a new promo before an existing one ends simply overwrites it —
 * there's no history kept, matching how simple this needs to be for v1.
 */
export async function startPromo(
  ctx: TenantContext,
  serviceId: string,
  input: StartPromoInput,
  actor: Actor
): Promise<Service> {
  const [service] = await getServicesByIds(ctx.salon.id, [serviceId]);
  if (!service) throw ApiError.notFound("Service not found.");

  if (input.type === "fixed" && input.value > service.priceCents) {
    throw ApiError.badRequest(
      "The promo price can't be higher than the regular price."
    );
  }

  const tz = ctx.salon.timezone;
  const promoStartsAt = localDateTimeToUtc(input.startsAt, "00:00", tz);
  const promoEndsAt = localDateTimeToUtc(input.endsAt, "23:59", tz);

  const updated = await updateService(ctx.salon.id, serviceId, {
    promoLabel: input.label?.trim() || null,
    promoType: input.type,
    promoValue: input.value,
    promoStartsAt,
    promoEndsAt,
  });
  if (!updated) throw ApiError.notFound("Service not found.");

  await recordAudit(db, {
    salonId: ctx.salon.id,
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "service.promo.started",
    entityType: "service",
    entityId: serviceId,
    changes: { ...input },
  });

  return updated;
}

/** Clear the promo fields — ends it immediately regardless of the scheduled window. */
export async function endPromo(
  ctx: TenantContext,
  serviceId: string,
  actor: Actor
): Promise<Service> {
  const updated = await updateService(ctx.salon.id, serviceId, {
    promoLabel: null,
    promoType: null,
    promoValue: null,
    promoStartsAt: null,
    promoEndsAt: null,
  });
  if (!updated) throw ApiError.notFound("Service not found.");

  await recordAudit(db, {
    salonId: ctx.salon.id,
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "service.promo.ended",
    entityType: "service",
    entityId: serviceId,
  });

  return updated;
}
