import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicReviewData } from "@/lib/services/reviews";
import { ReviewFlow } from "@/components/public/ReviewFlow";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; token: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Rate your visit" };
}

/** Public "rate your visit" page — token-gated, no Clerk session, linked from a manually-sent review request email. */
export default async function ReviewPage({ params }: Props) {
  const { id, token } = await params;

  const data = await getPublicReviewData(id, token);
  if (!data) notFound();

  return (
    <ReviewFlow
      appointmentId={data.appointment.id}
      token={token}
      alreadyReviewed={data.alreadyReviewed}
      appointment={{
        serviceNames: data.appointment.services.map((s) => s.serviceName),
        staffName: data.appointment.staff?.name ?? null,
      }}
      salon={{
        name: data.salon.name,
        logoUrl: data.salon.logoUrl,
        googleReviewUrl: data.salon.googleReviewUrl,
      }}
    />
  );
}
