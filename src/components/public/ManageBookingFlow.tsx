"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Field, Skeleton, Textarea } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

/**
 * Public "manage your booking" page — linked from confirmation/reminder
 * emails via a signed token. Never cancels or reschedules directly: it only
 * submits a request that shows up in the salon's app for a staff member to
 * approve or decline. Talks to /api/public/availability (reschedule slot
 * picking, same engine the original booking page uses) and
 * /api/public/manage (submitting the request).
 */

interface AppointmentInfo {
  status: string;
  startsAt: string;
  endsAt: string;
  serviceNames: string[];
  serviceIds: string[];
  staffId: string | null;
  staffName: string | null;
}

interface SalonInfo {
  slug: string;
  name: string;
  logoUrl: string | null;
  timezone: string;
  allowCancellation: boolean;
}

interface PendingRequest {
  type: "cancel" | "reschedule";
  createdAt: string;
}

interface Slot {
  startsAt: string;
  endsAt: string;
  staffId: string | null;
}

type View = "view" | "cancel" | "reschedule" | "done";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const ACTIVE_STATUSES = new Set(["pending", "confirmed"]);

export function ManageBookingFlow({
  appointmentId,
  token,
  appointment,
  salon,
  pendingRequest,
}: {
  appointmentId: string;
  token: string;
  appointment: AppointmentInfo;
  salon: SalonInfo;
  pendingRequest: PendingRequest | null;
}) {
  const [view, setView] = useState<View>("view");
  const [doneType, setDoneType] = useState<"cancel" | "reschedule" | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reschedule slot picking — same pattern as the original booking page.
  const [weekStart, setWeekStart] = useState(isoToday());
  const [slotsByDay, setSlotsByDay] = useState<Record<string, Slot[]>>({});
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);

  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: salon.timezone,
      }),
    [salon.timezone]
  );
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: salon.timezone,
      }),
    [salon.timezone]
  );
  const dayFmt = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
    []
  );

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        salon: salon.slug,
        date: weekStart,
        days: "7",
        serviceIds: appointment.serviceIds.join(","),
      });
      if (appointment.staffId) params.set("staffId", appointment.staffId);

      const res = await fetch(`/api/public/availability?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't load availability.");
      }
      const data = await res.json();
      setSlotsByDay(data.slots ?? {});
      const firstWithSlots = Object.keys(data.slots ?? {})
        .sort()
        .find((d) => data.slots[d].length > 0);
      setActiveDay(firstWithSlots ?? weekStart);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load availability.");
    } finally {
      setSlotsLoading(false);
    }
  }, [salon.slug, weekStart, appointment.serviceIds, appointment.staffId]);

  useEffect(() => {
    if (view === "reschedule") loadSlots();
  }, [view, loadSlots]);

  async function submitRequest(type: "cancel" | "reschedule") {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          token,
          type,
          requestedStartsAt: type === "reschedule" ? slot?.startsAt : undefined,
          note: note.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setDoneType(type);
      setView("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));
  const inactive = !ACTIVE_STATUSES.has(appointment.status);

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))]">
      <header className="bg-white dark:bg-ink-900 border-b border-ink-100 dark:border-ink-800">
        <div className="max-w-2xl mx-auto px-5 py-6 flex items-center gap-4">
          {salon.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={salon.logoUrl}
              alt={salon.name}
              className="w-12 h-12 rounded-xl object-contain bg-ink-50 dark:bg-ink-800"
            />
          ) : (
            <span className="w-12 h-12 rounded-xl bg-ink-900 dark:bg-gold-500 flex items-center justify-center">
              <Icon name="sparkle" className="w-5 h-5 text-gold-400 dark:text-white" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-ink-900 dark:text-ink-50 truncate">
              {salon.name}
            </h1>
            <p className="text-xs text-ink-400 truncate">Manage your booking</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8">
        {/* Booking summary — always visible */}
        <div className="rounded-2xl border border-gold-200 dark:border-gold-800 bg-gold-50/50 dark:bg-gold-900/10 p-4 mb-6">
          <p className="text-sm font-bold text-ink-900 dark:text-ink-50">
            {appointment.serviceNames.join(", ") || "Appointment"}
          </p>
          <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">
            {dateFmt.format(new Date(appointment.startsAt))} at{" "}
            {timeFmt.format(new Date(appointment.startsAt))}
            {appointment.staffName ? ` · with ${appointment.staffName}` : ""}
          </p>
        </div>

        {inactive ? (
          <p className="text-sm text-ink-400 text-center py-10">
            This booking is no longer active — there&apos;s nothing to change here.
          </p>
        ) : pendingRequest && view !== "done" ? (
          <div className="text-center py-10 animate-fade-up">
            <span className="inline-flex w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-900/20 items-center justify-center mb-4">
              <Icon name="clock" className="w-6 h-6 text-amber-600" />
            </span>
            <h2 className="text-lg font-bold text-ink-900 dark:text-ink-50">
              A request is already awaiting review
            </h2>
            <p className="text-sm text-ink-400 mt-2 max-w-sm mx-auto">
              You asked to {pendingRequest.type === "cancel" ? "cancel" : "reschedule"}{" "}
              this booking — {salon.name} hasn&apos;t responded yet. No need to submit
              another request.
            </p>
          </div>
        ) : view === "view" ? (
          <div className="animate-fade-up flex flex-col gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setSlot(null);
                setError(null);
                setView("reschedule");
              }}
            >
              Suggest a new time
              <Icon name="arrowRight" className="w-4 h-4" />
            </Button>
            {salon.allowCancellation ? (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  setError(null);
                  setView("cancel");
                }}
              >
                Request cancellation
              </Button>
            ) : (
              <p className="text-xs text-ink-400 text-center mt-2">
                To cancel this booking, please contact {salon.name} directly.
              </p>
            )}
          </div>
        ) : view === "cancel" ? (
          <div className="animate-fade-up flex flex-col gap-4">
            <h2 className="text-lg font-bold text-ink-900 dark:text-ink-50">
              Request cancellation
            </h2>
            <p className="text-sm text-ink-400">
              {salon.name} will review this and cancel it on their end — you&apos;ll
              still hear back from them.
            </p>
            <Field label="Reason (optional)">
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            {error && (
              <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-3.5 py-2.5">
                {error}
              </p>
            )}
            <div className="flex justify-between mt-2">
              <Button variant="ghost" onClick={() => setView("view")}>
                Back
              </Button>
              <Button
                variant="gold"
                size="lg"
                loading={submitting}
                onClick={() => submitRequest("cancel")}
              >
                Send request
              </Button>
            </div>
          </div>
        ) : view === "reschedule" ? (
          <div className="animate-fade-up">
            <h2 className="text-lg font-bold text-ink-900 dark:text-ink-50 mb-1">
              Suggest a new time
            </h2>
            <p className="text-sm text-ink-400 mb-5">
              Times shown in {salon.timezone.replace("_", " ")} time. {salon.name}{" "}
              will confirm before anything changes.
            </p>

            <div className="flex items-center justify-between mb-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={weekStart <= isoToday()}
                onClick={() => setWeekStart((w) => addDaysIso(w, -7))}
              >
                <Icon name="chevronLeft" className="w-4 h-4" /> Earlier
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setWeekStart((w) => addDaysIso(w, 7))}
              >
                Later <Icon name="chevronRight" className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1.5 mb-5">
              {days.map((d) => {
                const count = slotsByDay[d]?.length ?? 0;
                const active = activeDay === d;
                return (
                  <button
                    key={d}
                    onClick={() => setActiveDay(d)}
                    disabled={count === 0}
                    className={`flex flex-col items-center py-2.5 rounded-xl border text-center transition-all ${
                      active
                        ? "border-gold-500 bg-gold-50 dark:bg-gold-900/20"
                        : count > 0
                          ? "border-ink-200 dark:border-ink-700 hover:border-gold-300"
                          : "border-ink-100 dark:border-ink-800 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase text-ink-400">
                      {dayFmt.format(new Date(d + "T00:00:00Z")).split(" ")[0]}
                    </span>
                    <span
                      className={`text-sm font-bold ${active ? "text-gold-700 dark:text-gold-300" : "text-ink-800 dark:text-ink-100"}`}
                    >
                      {d.slice(8)}
                    </span>
                    <span className="text-[9px] text-ink-400">
                      {count > 0 ? `${count} slots` : "—"}
                    </span>
                  </button>
                );
              })}
            </div>

            {slotsLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : activeDay && (slotsByDay[activeDay]?.length ?? 0) > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slotsByDay[activeDay].map((s) => {
                  const selected = slot?.startsAt === s.startsAt;
                  return (
                    <button
                      key={s.startsAt}
                      onClick={() => setSlot(s)}
                      className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                        selected
                          ? "border-gold-500 bg-gold-500 text-white shadow-sm"
                          : "border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:border-gold-400"
                      }`}
                    >
                      {timeFmt.format(new Date(s.startsAt))}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-ink-400 text-center py-10">
                No free times this week — try &ldquo;Later&rdquo;.
              </p>
            )}

            <div className="mt-5">
              <Field label="Note (optional)">
                <Textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </div>

            {error && (
              <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-3.5 py-2.5 mt-4">
                {error}
              </p>
            )}

            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setView("view")}>
                Back
              </Button>
              <Button
                variant="gold"
                size="lg"
                disabled={!slot}
                loading={submitting}
                onClick={() => submitRequest("reschedule")}
              >
                Send request
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 animate-fade-up">
            <span className="inline-flex w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 items-center justify-center mb-5">
              <Icon name="check" className="w-8 h-8 text-emerald-600" />
            </span>
            <h2 className="text-2xl font-bold text-ink-900 dark:text-ink-50">
              Request sent
            </h2>
            <p className="text-sm text-ink-400 mt-2 max-w-sm mx-auto">
              {salon.name} will review your{" "}
              {doneType === "cancel" ? "cancellation" : "reschedule"} request and get
              back to you. Nothing has changed yet.
            </p>
          </div>
        )}
      </main>

      <footer className="max-w-2xl mx-auto px-5 pb-8 text-center">
        <p className="text-[11px] text-ink-300 dark:text-ink-600">Powered by Bookline</p>
      </footer>
    </div>
  );
}
