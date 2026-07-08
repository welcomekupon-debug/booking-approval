"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import {
  Button,
  Field,
  Input,
  Select,
  Toggle,
} from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";
import {
  DAY_KEYS,
  DEFAULT_SETTINGS,
  type BusinessSettings,
  type Service,
  type StaffMember,
} from "@/types/app";

const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const STEPS: { title: string; subtitle: string; icon: IconName }[] = [
  { title: "Business information", subtitle: "Tell us who you are", icon: "building" },
  { title: "Your logo", subtitle: "Add your brand", icon: "image" },
  { title: "Business hours", subtitle: "When are you open?", icon: "clock" },
  { title: "Staff members", subtitle: "Who works with you?", icon: "users" },
  { title: "Services offered", subtitle: "What can customers book?", icon: "tag" },
  { title: "Appointment duration", subtitle: "Your default timings", icon: "calendar" },
  { title: "Booking settings", subtitle: "How bookings behave", icon: "settings" },
  { title: "Notifications", subtitle: "Stay in the loop", icon: "bell" },
  { title: "You're all set!", subtitle: "Review and launch", icon: "sparkle" },
];

/** Decorative illustration — concentric gold rings around the step icon. */
function StepIllustration({ icon }: { icon: IconName }) {
  return (
    <div className="relative w-28 h-28 mx-auto mb-6">
      <span className="absolute inset-0 rounded-full border border-gold-200 dark:border-gold-800 animate-[spin_24s_linear_infinite]" style={{ borderStyle: "dashed" }} />
      <span className="absolute inset-3 rounded-full bg-gold-50 dark:bg-gold-900/20" />
      <span className="absolute inset-6 rounded-full bg-gold-100 dark:bg-gold-900/40 flex items-center justify-center">
        <Icon name={icon} className="w-8 h-8 text-gold-600" />
      </span>
      <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
      <span className="absolute bottom-2 left-1 w-1.5 h-1.5 rounded-full bg-gold-300 animate-pulse" style={{ animationDelay: "0.6s" }} />
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const {
    settings: existing,
    services: existingServices,
    staff: existingStaff,
    saveSettings,
    saveServices,
    saveStaff,
  } = useWorkspace();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<BusinessSettings>({
    ...DEFAULT_SETTINGS,
    ...existing,
  });
  const [staffList, setStaffList] = useState<StaffMember[]>(
    existingStaff.length > 0
      ? existingStaff
      : [{ rowIndex: 0, name: "", email: "", phone: "", role: "", color: "", active: true }]
  );
  const [serviceList, setServiceList] = useState<Service[]>(
    existingServices.length > 0
      ? existingServices
      : [{ rowIndex: 0, name: "", duration: "30", price: "", color: "", active: true }]
  );

  const progress = ((step + 1) / STEPS.length) * 100;

  function patch(partial: Partial<BusinessSettings>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  const canContinue = useMemo(() => {
    if (step === 0) return form.businessName.trim().length > 0;
    return true;
  }, [step, form.businessName]);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await Promise.all([
        saveSettings({ ...form, onboardingComplete: true }),
        saveServices(serviceList.filter((s) => s.name.trim())),
        saveStaff(staffList.filter((s) => s.name.trim())),
      ]);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  const current = STEPS[step];

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] flex flex-col">
      {/* Top bar with progress */}
      <div className="px-6 pt-6 max-w-2xl w-full mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-8 h-8 rounded-xl bg-ink-900 dark:bg-gold-500 flex items-center justify-center">
            <Icon name="sparkle" className="w-4 h-4 text-gold-400 dark:text-white" />
          </span>
          <span className="text-sm font-bold text-ink-900 dark:text-ink-50">
            Setting up your workspace
          </span>
          <span className="ml-auto text-xs font-semibold text-ink-400">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gold-500 transition-all duration-500 ease-spring"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* Step dots */}
        <div className="flex justify-between mt-3">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              aria-label={s.title}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === step
                  ? "bg-gold-500 scale-125"
                  : i < step
                    ? "bg-gold-300 cursor-pointer"
                    : "bg-ink-200 dark:bg-ink-700"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-start justify-center px-6 py-8">
        <div
          key={step}
          className="w-full max-w-2xl bg-white dark:bg-ink-900 border border-ink-100 dark:border-ink-800 rounded-2xl shadow-card p-8 animate-fade-up"
        >
          <StepIllustration icon={current.icon} />
          <h1 className="text-2xl font-bold text-center text-ink-900 dark:text-ink-50">
            {current.title}
          </h1>
          <p className="text-sm text-ink-400 text-center mt-1 mb-8">
            {current.subtitle}
          </p>

          {/* ── Step 1: Business info ── */}
          {step === 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Business name *">
                  <Input
                    value={form.businessName}
                    onChange={(e) => patch({ businessName: e.target.value })}
                    placeholder="e.g. Studio Aurora"
                    autoFocus
                  />
                </Field>
              </div>
              <Field label="Business type">
                <Select
                  value={form.businessType}
                  onChange={(e) => patch({ businessType: e.target.value })}
                >
                  <option value="">Choose…</option>
                  {["Hair & Beauty", "Barbershop", "Spa & Wellness", "Medical / Dental", "Fitness & Coaching", "Consulting", "Photography", "Other"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Phone">
                <Input
                  value={form.phone}
                  onChange={(e) => patch({ phone: e.target.value })}
                  placeholder="+386 40 123 456"
                />
              </Field>
              <Field label="Public email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => patch({ email: e.target.value })}
                  placeholder="hello@yourbusiness.com"
                />
              </Field>
              <Field label="Website">
                <Input
                  value={form.website}
                  onChange={(e) => patch({ website: e.target.value })}
                  placeholder="yourbusiness.com"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address">
                  <Input
                    value={form.address}
                    onChange={(e) => patch({ address: e.target.value })}
                    placeholder="Street, City"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ── Step 2: Logo ── */}
          {step === 1 && (
            <div className="flex flex-col items-center gap-5">
              <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-ink-200 dark:border-ink-700 flex items-center justify-center overflow-hidden bg-ink-50 dark:bg-ink-800">
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.logoUrl}
                    alt="Logo preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Icon name="image" className="w-8 h-8 text-ink-300" />
                )}
              </div>
              <div className="w-full max-w-sm">
                <Field
                  label="Logo URL"
                  hint="Paste a link to your logo image (e.g. from your website or Google Drive). You can change it anytime in Settings."
                >
                  <Input
                    value={form.logoUrl}
                    onChange={(e) => patch({ logoUrl: e.target.value })}
                    placeholder="https://…/logo.png"
                  />
                </Field>
              </div>
              <button
                onClick={() => setStep(step + 1)}
                className="text-xs font-semibold text-ink-400 hover:text-ink-600 transition-colors"
              >
                Skip for now →
              </button>
            </div>
          )}

          {/* ── Step 3: Hours ── */}
          {step === 2 && (
            <div className="flex flex-col gap-2">
              {DAY_KEYS.map((day) => {
                const h = form.hours[day] ?? { open: false, from: "09:00", to: "17:00" };
                return (
                  <div
                    key={day}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors ${
                      h.open
                        ? "border-gold-200 dark:border-gold-800 bg-gold-50/40 dark:bg-gold-900/10"
                        : "border-ink-100 dark:border-ink-800"
                    }`}
                  >
                    <button
                      role="switch"
                      aria-checked={h.open}
                      onClick={() =>
                        patch({
                          hours: { ...form.hours, [day]: { ...h, open: !h.open } },
                        })
                      }
                      className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-300 ${
                        h.open ? "bg-gold-500" : "bg-ink-200 dark:bg-ink-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                          h.open ? "translate-x-4" : ""
                        }`}
                      />
                    </button>
                    <span className="text-sm font-semibold text-ink-800 dark:text-ink-100 w-24">
                      {DAY_LABELS[day]}
                    </span>
                    {h.open ? (
                      <div className="flex items-center gap-2 ml-auto">
                        <Input
                          type="time"
                          value={h.from}
                          onChange={(e) =>
                            patch({
                              hours: {
                                ...form.hours,
                                [day]: { ...h, from: e.target.value },
                              },
                            })
                          }
                          className="w-28 py-1.5 text-xs"
                        />
                        <span className="text-ink-300">–</span>
                        <Input
                          type="time"
                          value={h.to}
                          onChange={(e) =>
                            patch({
                              hours: {
                                ...form.hours,
                                [day]: { ...h, to: e.target.value },
                              },
                            })
                          }
                          className="w-28 py-1.5 text-xs"
                        />
                      </div>
                    ) : (
                      <span className="ml-auto text-xs text-ink-300 dark:text-ink-600">
                        Closed
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Step 4: Staff ── */}
          {step === 3 && (
            <div className="flex flex-col gap-3">
              {staffList.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <Field label={i === 0 ? "Name" : ""}>
                    <Input
                      value={s.name}
                      onChange={(e) =>
                        setStaffList((list) =>
                          list.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x))
                        )
                      }
                      placeholder="Full name"
                    />
                  </Field>
                  <Field label={i === 0 ? "Role" : ""}>
                    <Input
                      value={s.role}
                      onChange={(e) =>
                        setStaffList((list) =>
                          list.map((x, xi) => (xi === i ? { ...x, role: e.target.value } : x))
                        )
                      }
                      placeholder="e.g. Stylist"
                    />
                  </Field>
                  <button
                    onClick={() => setStaffList((list) => list.filter((_, xi) => xi !== i))}
                    className="p-2.5 mb-0.5 rounded-xl text-ink-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                    aria-label="Remove staff member"
                  >
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <Button
                variant="secondary"
                icon="plus"
                onClick={() =>
                  setStaffList((list) => [
                    ...list,
                    { rowIndex: 0, name: "", email: "", phone: "", role: "", color: "", active: true },
                  ])
                }
              >
                Add staff member
              </Button>
              <p className="text-xs text-ink-400 text-center">
                Working alone? Just leave this empty and continue.
              </p>
            </div>
          )}

          {/* ── Step 5: Services ── */}
          {step === 4 && (
            <div className="flex flex-col gap-3">
              {serviceList.map((s, i) => (
                <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
                  <Field label={i === 0 ? "Service" : ""}>
                    <Input
                      value={s.name}
                      onChange={(e) =>
                        setServiceList((list) =>
                          list.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x))
                        )
                      }
                      placeholder="e.g. Haircut"
                    />
                  </Field>
                  <Field label={i === 0 ? "Minutes" : ""}>
                    <Input
                      type="number"
                      min={5}
                      step={5}
                      value={s.duration}
                      onChange={(e) =>
                        setServiceList((list) =>
                          list.map((x, xi) =>
                            xi === i ? { ...x, duration: e.target.value } : x
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label={i === 0 ? `Price` : ""}>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={s.price}
                      onChange={(e) =>
                        setServiceList((list) =>
                          list.map((x, xi) => (xi === i ? { ...x, price: e.target.value } : x))
                        )
                      }
                      placeholder="0"
                    />
                  </Field>
                  <button
                    onClick={() => setServiceList((list) => list.filter((_, xi) => xi !== i))}
                    className="p-2.5 mb-0.5 rounded-xl text-ink-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                    aria-label="Remove service"
                  >
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <Button
                variant="secondary"
                icon="plus"
                onClick={() =>
                  setServiceList((list) => [
                    ...list,
                    { rowIndex: 0, name: "", duration: String(form.defaultDuration), price: "", color: "", active: true },
                  ])
                }
              >
                Add service
              </Button>
            </div>
          )}

          {/* ── Step 6: Duration ── */}
          {step === 5 && (
            <div className="flex flex-col gap-6 max-w-sm mx-auto">
              <Field
                label="Default appointment duration"
                hint="Used when a booking doesn't specify its own duration."
              >
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 45, 60].map((d) => (
                    <button
                      key={d}
                      onClick={() => patch({ defaultDuration: d })}
                      className={`py-3 rounded-xl border text-sm font-bold transition-all ${
                        form.defaultDuration === d
                          ? "border-gold-500 bg-gold-50 dark:bg-gold-900/20 text-gold-700 dark:text-gold-300 shadow-gold-glow"
                          : "border-ink-200 dark:border-ink-700 text-ink-500 hover:border-gold-300"
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </Field>
              <Field
                label="Buffer between appointments (minutes)"
                hint="Breathing room before the next booking can start."
              >
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={form.bufferMinutes}
                  onChange={(e) => patch({ bufferMinutes: Number(e.target.value) || 0 })}
                />
              </Field>
            </div>
          )}

          {/* ── Step 7: Booking settings ── */}
          {step === 6 && (
            <div className="flex flex-col gap-4 max-w-md mx-auto">
              <Toggle
                checked={form.autoConfirm}
                onChange={(v) => patch({ autoConfirm: v })}
                label="Auto-confirm requests"
                description="Skip manual review — every request is confirmed instantly."
              />
              <Toggle
                checked={form.allowCancellation}
                onChange={(v) => patch({ allowCancellation: v })}
                label="Allow cancellations"
                description="Customers may cancel their confirmed appointments."
              />
              <Toggle
                checked={form.revenueEnabled}
                onChange={(v) => patch({ revenueEnabled: v })}
                label="Track revenue"
                description="Show revenue stats based on appointment prices."
              />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <Field label="Currency">
                  <Select
                    value={form.currency}
                    onChange={(e) => patch({ currency: e.target.value })}
                  >
                    {["EUR", "USD", "GBP", "CHF"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Book up to (days ahead)">
                  <Input
                    type="number"
                    min={1}
                    value={form.maxAdvanceDays}
                    onChange={(e) => patch({ maxAdvanceDays: Number(e.target.value) || 60 })}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ── Step 8: Notifications ── */}
          {step === 7 && (
            <div className="flex flex-col gap-4 max-w-md mx-auto">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-300 dark:text-ink-600">
                Email
              </p>
              <Toggle
                checked={form.notifyEmailNewRequest}
                onChange={(v) => patch({ notifyEmailNewRequest: v })}
                label="New booking requests"
              />
              <Toggle
                checked={form.notifyEmailConfirmation}
                onChange={(v) => patch({ notifyEmailConfirmation: v })}
                label="Confirmations"
              />
              <Toggle
                checked={form.notifyEmailDailySummary}
                onChange={(v) => patch({ notifyEmailDailySummary: v })}
                label="Daily summary"
              />
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-300 dark:text-ink-600 mt-2">
                SMS
              </p>
              <Toggle
                checked={form.notifySmsReminder}
                onChange={(v) => patch({ notifySmsReminder: v })}
                label="Customer reminders"
                description={`Sent ${form.reminderHoursBefore}h before the appointment.`}
              />
              <Field label="Reminder timing (hours before)">
                <Input
                  type="number"
                  min={1}
                  max={72}
                  value={form.reminderHoursBefore}
                  onChange={(e) => patch({ reminderHoursBefore: Number(e.target.value) || 24 })}
                />
              </Field>
            </div>
          )}

          {/* ── Step 9: Finish ── */}
          {step === 8 && (
            <div className="max-w-md mx-auto">
              <div className="rounded-xl border border-ink-100 dark:border-ink-800 divide-y divide-ink-50 dark:divide-ink-800 mb-6">
                {[
                  ["Business", form.businessName || "—"],
                  ["Type", form.businessType || "—"],
                  [
                    "Open days",
                    DAY_KEYS.filter((d) => form.hours[d]?.open)
                      .map((d) => DAY_LABELS[d].slice(0, 3))
                      .join(", ") || "—",
                  ],
                  ["Staff", String(staffList.filter((s) => s.name.trim()).length)],
                  ["Services", String(serviceList.filter((s) => s.name.trim()).length)],
                  ["Default duration", `${form.defaultDuration} min`],
                  ["Auto-confirm", form.autoConfirm ? "On" : "Off"],
                  ["Revenue tracking", form.revenueEnabled ? "On" : "Off"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-ink-400">{k}</span>
                    <span className="font-semibold text-ink-800 dark:text-ink-100">{v}</span>
                  </div>
                ))}
              </div>
              {error && (
                <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-3.5 py-2.5 mb-4">
                  {error}
                </p>
              )}
              <Button
                variant="gold"
                size="lg"
                className="w-full"
                icon="sparkle"
                loading={saving}
                onClick={finish}
              >
                Launch my workspace
              </Button>
            </div>
          )}

          {/* Navigation */}
          {step < 8 && (
            <div className="flex items-center justify-between mt-10">
              <Button
                variant="ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="lg"
                disabled={!canContinue}
                onClick={() => setStep((s) => s + 1)}
              >
                Continue
                <Icon name="arrowRight" className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
