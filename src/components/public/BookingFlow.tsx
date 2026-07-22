"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Field, Input, Skeleton, Textarea } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

/**
 * Customer-facing booking flow: services → time → details → confirmation.
 * Talks to /api/public/availability and /api/public/book.
 */

interface PublicSalon {
  slug: string;
  name: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  timezone: string;
  currency: string;
}

interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
}

interface PublicStaff {
  id: string;
  name: string;
}

interface Slot {
  startsAt: string; // ISO UTC
  endsAt: string;
  staffId: string | null;
}

type Step = "services" | "time" | "details" | "done";

function fmtPrice(cents: number, currency: string) {
  if (!cents) return "Free";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function BookingFlow({
  salon,
  services,
  staff,
}: {
  salon: PublicSalon;
  services: PublicService[];
  staff: PublicStaff[];
}) {
  const [step, setStep] = useState<Step>("services");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [staffId, setStaffId] = useState<string>("");
  const [weekStart, setWeekStart] = useState(isoToday());
  const [slotsByDay, setSlotsByDay] = useState<Record<string, Slot[]>>({});
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; startsAt: string } | null>(null);

  const chosenServices = useMemo(
    () => services.filter((s) => selectedServices.includes(s.id)),
    [services, selectedServices]
  );
  const totalMinutes = chosenServices.reduce((s, x) => s + x.durationMinutes, 0);
  const totalCents = chosenServices.reduce((s, x) => s + x.priceCents, 0);

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

  // ── Availability fetch ────────────────────────────────────────────────────

  const loadSlots = useCallback(async () => {
    if (selectedServices.length === 0) return;
    setSlotsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        salon: salon.slug,
        date: weekStart,
        days: "7",
        serviceIds: selectedServices.join(","),
      });
      if (staffId) params.set("staffId", staffId);

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
  }, [salon.slug, weekStart, selectedServices, staffId]);

  useEffect(() => {
    if (step === "time") loadSlots();
  }, [step, loadSlots]);

  // ── Submit ────────────────────────────────────────────────────────────────

  async function submit() {
    if (!slot || !name.trim() || !email.trim()) {
      setError("Please fill in your name and email.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salon: salon.slug,
          customer: { name: name.trim(), email: email.trim(), phone: phone.trim() || null },
          serviceIds: selectedServices,
          staffId: slot.staffId ?? (staffId || null),
          startsAt: slot.startsAt,
          note: note.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Booking failed. Please try again.");
      }
      setResult({ status: body.status, startsAt: body.startsAt });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed.");
      // Slot may have been taken meanwhile — refresh availability
      if (err instanceof Error && /no longer available/i.test(err.message)) {
        setStep("time");
        setSlot(null);
        loadSlots();
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── UI pieces ─────────────────────────────────────────────────────────────

  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));

  const STEPS: { key: Step; label: string }[] = [
    { key: "services", label: "Services" },
    { key: "time", label: "Time" },
    { key: "details", label: "Your details" },
  ];
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))]">
      {/* Header */}
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
            <p className="text-xs text-ink-400 truncate">
              {salon.address || "Book your appointment online"}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8">
        {/* Progress */}
        {step !== "done" && (
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2 flex-1 last:flex-none">
                <button
                  onClick={() => i < stepIndex && setStep(s.key)}
                  disabled={i >= stepIndex}
                  className={`flex items-center gap-2 text-xs font-bold whitespace-nowrap ${
                    i === stepIndex
                      ? "text-ink-900 dark:text-ink-50"
                      : i < stepIndex
                        ? "text-gold-600 cursor-pointer"
                        : "text-ink-300 dark:text-ink-600"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                      i < stepIndex
                        ? "bg-gold-500 text-white"
                        : i === stepIndex
                          ? "bg-ink-900 dark:bg-ink-50 text-white dark:text-ink-900"
                          : "bg-ink-100 dark:bg-ink-800 text-ink-400"
                    }`}
                  >
                    {i < stepIndex ? <Icon name="check" className="w-3 h-3" /> : i + 1}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-px bg-ink-100 dark:bg-ink-800" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Step 1: services ── */}
        {step === "services" && (
          <div className="animate-fade-up">
            <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50 mb-1">
              What would you like?
            </h2>
            <p className="text-sm text-ink-400 mb-5">Choose one or more services.</p>

            {services.length === 0 ? (
              <p className="text-sm text-ink-400 py-10 text-center">
                Online booking isn&apos;t available yet — please contact{" "}
                {salon.name} directly{salon.phone ? ` at ${salon.phone}` : ""}.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {services.map((s) => {
                  const selected = selectedServices.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() =>
                        setSelectedServices((prev) =>
                          selected ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                        )
                      }
                      className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-200 ${
                        selected
                          ? "border-gold-500 bg-gold-50/60 dark:bg-gold-900/15 shadow-gold-glow"
                          : "border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 hover:border-gold-300"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selected
                            ? "border-gold-500 bg-gold-500"
                            : "border-ink-300 dark:border-ink-600"
                        }`}
                      >
                        {selected && <Icon name="check" className="w-3 h-3 text-white" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-ink-900 dark:text-ink-50">
                          {s.name}
                        </span>
                        {s.description && (
                          <span className="block text-xs text-ink-400 truncate">
                            {s.description}
                          </span>
                        )}
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block text-sm font-bold text-ink-900 dark:text-ink-50">
                          {fmtPrice(s.priceCents, salon.currency)}
                        </span>
                        <span className="block text-[11px] text-ink-400">
                          {s.durationMinutes} min
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {staff.length > 1 && (
              <div className="mt-5">
                <Field label="Preferred staff member (optional)">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setStaffId("")}
                      className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                        !staffId
                          ? "border-gold-500 bg-gold-50 dark:bg-gold-900/20 text-gold-700 dark:text-gold-300"
                          : "border-ink-200 dark:border-ink-700 text-ink-500"
                      }`}
                    >
                      Anyone
                    </button>
                    {staff.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setStaffId(m.id)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                          staffId === m.id
                            ? "border-gold-500 bg-gold-50 dark:bg-gold-900/20 text-gold-700 dark:text-gold-300"
                            : "border-ink-200 dark:border-ink-700 text-ink-500"
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            )}

            <div className="flex items-center justify-between mt-8">
              <p className="text-sm text-ink-400">
                {selectedServices.length > 0 && (
                  <>
                    <span className="font-bold text-ink-900 dark:text-ink-50">
                      {fmtPrice(totalCents, salon.currency)}
                    </span>{" "}
                    · {totalMinutes} min
                  </>
                )}
              </p>
              <Button
                variant="primary"
                size="lg"
                disabled={selectedServices.length === 0}
                onClick={() => setStep("time")}
              >
                Choose a time
                <Icon name="arrowRight" className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: time ── */}
        {step === "time" && (
          <div className="animate-fade-up">
            <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50 mb-1">
              Pick a time
            </h2>
            <p className="text-sm text-ink-400 mb-5">
              Times shown in {salon.timezone.replace("_", " ")} time.
            </p>

            {/* Week navigation */}
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

            {/* Day strip */}
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

            {/* Slots */}
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

            {error && (
              <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-3.5 py-2.5 mt-4">
                {error}
              </p>
            )}

            <div className="flex justify-between mt-8">
              <Button variant="ghost" onClick={() => setStep("services")}>
                Back
              </Button>
              <Button
                variant="primary"
                size="lg"
                disabled={!slot}
                onClick={() => setStep("details")}
              >
                Continue
                <Icon name="arrowRight" className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: details ── */}
        {step === "details" && slot && (
          <div className="animate-fade-up">
            <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50 mb-5">
              Your details
            </h2>

            {/* Summary */}
            <div className="rounded-2xl border border-gold-200 dark:border-gold-800 bg-gold-50/50 dark:bg-gold-900/10 p-4 mb-6">
              <p className="text-sm font-bold text-ink-900 dark:text-ink-50">
                {chosenServices.map((s) => s.name).join(", ")}
              </p>
              <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">
                {new Intl.DateTimeFormat("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: salon.timezone,
                }).format(new Date(slot.startsAt))}{" "}
                at {timeFmt.format(new Date(slot.startsAt))} · {totalMinutes} min ·{" "}
                {fmtPrice(totalCents, salon.currency)}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <Field label="Full name *">
                <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Email *">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field label="Phone">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
              </div>
              <Field label="Anything we should know?">
                <Textarea
                  rows={2}
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
                <Button variant="ghost" onClick={() => setStep("time")}>
                  Back
                </Button>
                <Button
                  variant="gold"
                  size="lg"
                  loading={submitting}
                  onClick={submit}
                >
                  Confirm booking
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: done ── */}
        {step === "done" && result && (
          <div className="text-center py-12 animate-fade-up">
            <span className="inline-flex w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 items-center justify-center mb-5">
              <Icon name="check" className="w-8 h-8 text-emerald-600" />
            </span>
            <h2 className="text-2xl font-bold text-ink-900 dark:text-ink-50">
              {result.status === "confirmed"
                ? "You're booked!"
                : "Request received!"}
            </h2>
            <p className="text-sm text-ink-400 mt-2 max-w-sm mx-auto">
              {result.status === "confirmed"
                ? `See you on ${new Intl.DateTimeFormat("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: salon.timezone,
                  }).format(new Date(result.startsAt))} at ${timeFmt.format(new Date(result.startsAt))}.`
                : `${salon.name} will review your request and confirm shortly. You'll hear from them at ${email}.`}
            </p>
            <Button
              variant="secondary"
              className="mt-8"
              onClick={() => {
                setStep("services");
                setSelectedServices([]);
                setSlot(null);
                setResult(null);
              }}
            >
              Book another appointment
            </Button>
          </div>
        )}
      </main>

      <footer className="max-w-2xl mx-auto px-5 pb-8 text-center">
        <p className="text-[11px] text-ink-300 dark:text-ink-600">
          Powered by Bookline
        </p>
      </footer>
    </div>
  );
}
