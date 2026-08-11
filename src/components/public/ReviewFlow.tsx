"use client";

import { useState } from "react";
import { Button, Textarea } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

/**
 * Public "rate your visit" page — linked from a manually-sent review
 * request email via a signed token. Purely internal feedback: the rating
 * and comment are never shown to the public. Only after a high rating (4-5)
 * do we surface a "share this on Google too?" link to the salon's own
 * Google Business review page — low ratings stay internal so the salon gets
 * a chance to make it right before anything goes public.
 */

interface ReviewAppointmentInfo {
  serviceNames: string[];
  staffName: string | null;
}

interface ReviewSalonInfo {
  name: string;
  logoUrl: string | null;
  googleReviewUrl: string | null;
}

export function ReviewFlow({
  appointmentId,
  token,
  alreadyReviewed,
  appointment,
  salon,
}: {
  appointmentId: string;
  token: string;
  alreadyReviewed: boolean;
  appointment: ReviewAppointmentInfo;
  salon: ReviewSalonInfo;
}) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRating, setSubmittedRating] = useState<number | null>(null);

  async function submit() {
    if (rating < 1) {
      setError("Pick a star rating first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          token,
          rating,
          comment: comment.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't submit your rating.");
      setSubmittedRating(rating);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit your rating.");
    } finally {
      setSubmitting(false);
    }
  }

  const done = submittedRating !== null;
  const showGoogleCta = done && submittedRating! >= 4 && salon.googleReviewUrl;

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          {salon.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={salon.logoUrl}
              alt={salon.name}
              className="w-14 h-14 rounded-2xl object-contain bg-white dark:bg-ink-800 border border-ink-100 dark:border-ink-700 mb-3"
            />
          ) : (
            <span className="w-14 h-14 rounded-2xl bg-ink-900 dark:bg-gold-500 flex items-center justify-center mb-3">
              <Icon name="sparkle" className="w-6 h-6 text-gold-400 dark:text-white" />
            </span>
          )}
          <h1 className="text-lg font-bold text-ink-900 dark:text-ink-50">{salon.name}</h1>
        </div>

        <div className="rounded-2xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-6">
          {alreadyReviewed && !done ? (
            <div className="text-center py-4">
              <Icon name="check" className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                You&apos;ve already rated this visit
              </p>
              <p className="text-xs text-ink-400 mt-1">Thanks for the feedback!</p>
            </div>
          ) : done ? (
            <div className="text-center py-4">
              <Icon name="check" className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 mb-1">
                Thanks for letting us know!
              </p>
              {showGoogleCta ? (
                <>
                  <p className="text-xs text-ink-400 mb-4">
                    Glad you had a great visit — mind sharing that on Google too?
                  </p>
                  <a href={salon.googleReviewUrl!} target="_blank" rel="noopener noreferrer">
                    <Button variant="gold" className="w-full">
                      Leave a Google review
                    </Button>
                  </a>
                </>
              ) : (
                <p className="text-xs text-ink-400">
                  We&apos;ll use this to keep improving.
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 text-center mb-1">
                How was your visit?
              </p>
              <p className="text-xs text-ink-400 text-center mb-5">
                {appointment.serviceNames.join(", ") || "Your appointment"}
                {appointment.staffName ? ` with ${appointment.staffName}` : ""}
              </p>

              <div className="flex items-center justify-center gap-1.5 mb-5">
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = n <= (hovered || rating);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHovered(n)}
                      onMouseLeave={() => setHovered(0)}
                      aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <Icon
                        name="star"
                        className={`w-8 h-8 ${filled ? "text-gold-500" : "text-ink-200 dark:text-ink-700"}`}
                        fill={filled ? "currentColor" : "none"}
                      />
                    </button>
                  );
                })}
              </div>

              <Textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Anything you'd like to add? (optional)"
                className="mb-4"
              />

              {error && (
                <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-3.5 py-2.5 mb-4">
                  {error}
                </p>
              )}

              <Button
                variant="primary"
                className="w-full"
                loading={submitting}
                disabled={rating < 1}
                onClick={submit}
              >
                Submit rating
              </Button>
            </>
          )}
        </div>

        <p className="text-[11px] text-ink-300 dark:text-ink-600 text-center mt-6">
          Powered by Bookline
        </p>
      </div>
    </div>
  );
}
