"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Skeleton,
  Toast,
  useAutoDismiss,
} from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import { longDate } from "@/lib/dates";

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  customerName: string;
  staffName: string | null;
  createdAt: string;
}

interface StaffSummaryRow {
  staffId: string | null;
  staffName: string | null;
  avgRating: number;
  count: number;
}

interface ReviewsResponse {
  linked: boolean;
  staffSummary: StaffSummaryRow[] | null;
  reviews: ReviewRow[];
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name="star"
          className={`${cls} ${n <= rating ? "text-gold-500" : "text-ink-200 dark:text-ink-700"}`}
          fill={n <= rating ? "currentColor" : "none"}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(isoToday());
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useAutoDismiss(toast, () => setToast(null));

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reviews");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't load reviews.");
      setData(body);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sendRequests() {
    setSending(true);
    try {
      const res = await fetch("/api/reviews/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't send review requests.");
      setToast(
        body.sent === 0
          ? "No new appointments to send to that day"
          : `Sent ${body.sent} review request${body.sent === 1 ? "" : "s"}`
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Couldn't send review requests.");
    } finally {
      setSending(false);
    }
  }

  const overallAvg = useMemo(() => {
    if (!data || data.reviews.length === 0) return null;
    return (
      data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.reviews.length
    );
  }, [data]);

  if (error) {
    return (
      <EmptyState
        icon="x"
        title="Couldn't load reviews"
        description={error}
        action={
          <Button variant="primary" icon="refresh" onClick={load}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Reviews"
        subtitle={
          loading
            ? "Loading…"
            : data && data.reviews.length > 0
              ? `${data.reviews.length} review${data.reviews.length === 1 ? "" : "s"} · ${overallAvg?.toFixed(1)} average`
              : "Internal feedback on your team's work"
        }
      />

      <Card className="animate-fade-up mb-6">
        <div className="px-6 pt-5 pb-4 border-b border-ink-50 dark:border-ink-800">
          <h2 className="text-base font-bold text-ink-900 dark:text-ink-50">
            Send review requests
          </h2>
          <p className="text-xs text-ink-400 mt-1">
            Emails everyone whose appointment happened on that day and wasn&apos;t a
            no-show or cancellation. Safe to run more than once — already-requested
            appointments are skipped.
          </p>
        </div>
        <div className="px-6 py-5 flex flex-wrap items-center gap-3">
          <Input
            type="date"
            value={date}
            max={isoToday()}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
          <Button variant="primary" icon="send" loading={sending} onClick={sendRequests}>
            Send review requests
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : !data?.linked ? (
        <EmptyState
          icon="star"
          title="Your account isn't linked to a staff profile yet"
          description="Ask an owner or manager to link you to your staff profile in Settings → Team so your reviews show up here."
        />
      ) : (
        <>
          {data.staffSummary && data.staffSummary.length > 0 && (
            <Card className="animate-fade-up mb-6">
              <div className="px-6 pt-5 pb-4 border-b border-ink-50 dark:border-ink-800">
                <h2 className="text-base font-bold text-ink-900 dark:text-ink-50">
                  By staff member
                </h2>
              </div>
              <div className="px-6 py-4 flex flex-col divide-y divide-ink-50 dark:divide-ink-800">
                {data.staffSummary
                  .slice()
                  .sort((a, b) => b.avgRating - a.avgRating)
                  .map((s) => (
                    <div
                      key={s.staffId ?? "unassigned"}
                      className="flex items-center justify-between py-2.5"
                    >
                      <span className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                        {s.staffName ?? "Unassigned"}
                      </span>
                      <div className="flex items-center gap-2.5">
                        <Stars rating={Math.round(s.avgRating)} />
                        <span className="text-xs text-ink-400 w-20 text-right">
                          {s.avgRating.toFixed(1)} · {s.count}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          <Card className="animate-fade-up">
            <div className="px-6 pt-5 pb-4 border-b border-ink-50 dark:border-ink-800">
              <h2 className="text-base font-bold text-ink-900 dark:text-ink-50">
                All feedback
              </h2>
            </div>
            {data.reviews.length === 0 ? (
              <div className="px-6 py-10">
                <EmptyState
                  icon="star"
                  title="No reviews yet"
                  description="Send a review request after your next appointments to start collecting feedback."
                />
              </div>
            ) : (
              <div className="px-6 py-2 flex flex-col divide-y divide-ink-50 dark:divide-ink-800">
                {data.reviews.map((r) => (
                  <div key={r.id} className="py-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <Stars rating={r.rating} size="md" />
                        <span className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                          {r.customerName}
                        </span>
                      </div>
                      <span className="text-[11px] text-ink-400">
                        {longDate(new Date(r.createdAt))}
                        {r.staffName ? ` · ${r.staffName}` : ""}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="text-sm text-ink-600 dark:text-ink-300">{r.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <Toast message={toast} />
    </div>
  );
}
