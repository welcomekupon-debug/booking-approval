import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSalonBySlug } from "@/lib/repositories/salons";
import { listServices, listStaff } from "@/lib/repositories/catalog";
import { BookingFlow } from "@/components/public/BookingFlow";
import { effectivePriceCents, isPromoActive } from "@/lib/services/pricing";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const salon = await getSalonBySlug(slug);
  return {
    title: salon ? `Book at ${salon.name}` : "Book an appointment",
    description: salon
      ? `Book your appointment at ${salon.name} online.`
      : undefined,
  };
}

/** Public booking page — no authentication, no app shell. */
export default async function PublicBookingPage({ params }: Props) {
  const { slug } = await params;

  const salon = await getSalonBySlug(slug);
  if (!salon) notFound();

  const [services, staff] = await Promise.all([
    listServices(salon.id, { publicOnly: true }),
    listStaff(salon.id),
  ]);

  return (
    <BookingFlow
      salon={{
        slug: salon.slug,
        name: salon.name,
        logoUrl: salon.logoUrl,
        address: salon.address,
        phone: salon.phone,
        timezone: salon.timezone,
        currency: salon.currency,
      }}
      services={services.map((s) => {
        const promoActive = isPromoActive(s);
        return {
          id: s.id,
          name: s.name,
          description: s.description,
          durationMinutes: s.durationMinutes,
          priceCents: effectivePriceCents(s),
          originalPriceCents: promoActive ? s.priceCents : null,
          promoLabel: promoActive ? s.promoLabel : null,
        };
      })}
      staff={staff.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
