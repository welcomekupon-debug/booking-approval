"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { PageHeader } from "@/components/PageHeader";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Segmented,
  Select,
  Toast,
  Toggle,
  useAutoDismiss,
} from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";
import { IntegrationsSection } from "@/components/settings/IntegrationsSection";
import {
  DAY_KEYS,
  type BusinessSettings,
  type Service,
  type StaffMember,
} from "@/types/app";

type Tab =
  | "business"
  | "branding"
  | "hours"
  | "staff"
  | "services"
  | "booking"
  | "integrations"
  | "notifications"
  | "security"
  | "billing";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "business", label: "Business profile", icon: "building" },
  { id: "branding", label: "Branding", icon: "image" },
  { id: "hours", label: "Working hours", icon: "clock" },
  { id: "staff", label: "Staff", icon: "users" },
  { id: "services", label: "Services", icon: "tag" },
  { id: "booking", label: "Booking preferences", icon: "calendar" },
  { id: "integrations", label: "Online booking & API", icon: "send" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { id: "security", label: "Security", icon: "shield" },
  { id: "billing", label: "Subscription & billing", icon: "card" },
];

const DAY_LABELS: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};

function SectionCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="animate-fade-up">
      <div className="px-6 pt-5 pb-4 border-b border-ink-50 dark:border-ink-800">
        <h2 className="text-base font-bold text-ink-900 dark:text-ink-50">{title}</h2>
        {description && <p className="text-xs text-ink-400 mt-1">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t border-ink-50 dark:border-ink-800 flex justify-end">
          {footer}
        </div>
      )}
    </Card>
  );
}

function SettingsContent() {
  const params = useSearchParams();
  const { user } = useUser();
  const clerk = useClerk();
  const {
    settings,
    services,
    staff,
    saveSettings,
    saveServices,
    saveStaff,
  } = useWorkspace();

  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "business");
  const [form, setForm] = useState<BusinessSettings>(settings);
  const [serviceList, setServiceList] = useState<Service[]>(services);
  const [staffList, setStaffList] = useState<StaffMember[]>(staff);
  const [holidayInput, setHolidayInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [granularityMode, setGranularityMode] = useState<
    "15" | "30" | "60" | "custom"
  >(
    [15, 30, 60].includes(settings.slotGranularityMinutes)
      ? (String(settings.slotGranularityMinutes) as "15" | "30" | "60")
      : "custom"
  );

  useAutoDismiss(toast, () => setToast(null));

  useEffect(() => setForm(settings), [settings]);
  useEffect(() => {
    setGranularityMode(
      [15, 30, 60].includes(settings.slotGranularityMinutes)
        ? (String(settings.slotGranularityMinutes) as "15" | "30" | "60")
        : "custom"
    );
  }, [settings.slotGranularityMinutes]);
  useEffect(() => setServiceList(services), [services]);
  useEffect(() => setStaffList(staff), [staff]);

  useEffect(() => {
    const t = params.get("tab") as Tab | null;
    if (t && TABS.some((x) => x.id === t)) setTab(t);
  }, [params]);

  function patch(partial: Partial<BusinessSettings>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  async function persistSettings(partial?: Partial<BusinessSettings>) {
    setSaving(true);
    try {
      await saveSettings(partial ?? form);
      setToast("Settings saved");
    } catch {
      setToast("Couldn't save — please try again");
    } finally {
      setSaving(false);
    }
  }

  async function persistServices() {
    setSaving(true);
    try {
      await saveServices(serviceList.filter((s) => s.name.trim()));
      setToast("Services saved");
    } catch {
      setToast("Couldn't save — please try again");
    } finally {
      setSaving(false);
    }
  }

  async function persistStaff() {
    setSaving(true);
    try {
      await saveStaff(staffList.filter((s) => s.name.trim()));
      setToast("Staff saved");
    } catch {
      setToast("Couldn't save — please try again");
    } finally {
      setSaving(false);
    }
  }

  const saveBtn = (onClick: () => void) => (
    <Button variant="primary" loading={saving} onClick={onClick}>
      Save changes
    </Button>
  );

  const holidays = useMemo(
    () => [...form.holidays].sort(),
    [form.holidays]
  );

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Everything about how your business runs."
      />

      <div className="grid lg:grid-cols-[220px_1fr] gap-6 items-start">
        {/* Tab nav */}
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 animate-fade-up">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                tab === t.id
                  ? "bg-ink-900 text-white dark:bg-ink-50 dark:text-ink-900 shadow-card"
                  : "text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
              }`}
            >
              <Icon
                name={t.icon}
                className={`w-4 h-4 shrink-0 ${tab === t.id ? "text-gold-400 dark:text-gold-600" : ""}`}
              />
              {t.label}
            </button>
          ))}
        </nav>

        {/* Panels */}
        <div className="min-w-0">
          {tab === "business" && (
            <SectionCard
              title="Business profile"
              description="Shown to your customers and used across the app."
              footer={saveBtn(() => persistSettings())}
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Business name">
                    <Input
                      value={form.businessName}
                      onChange={(e) => patch({ businessName: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Business type">
                  <Input
                    value={form.businessType}
                    onChange={(e) => patch({ businessType: e.target.value })}
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={form.phone}
                    onChange={(e) => patch({ phone: e.target.value })}
                  />
                </Field>
                <Field label="Public email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => patch({ email: e.target.value })}
                  />
                </Field>
                <Field label="Website">
                  <Input
                    value={form.website}
                    onChange={(e) => patch({ website: e.target.value })}
                  />
                </Field>
                <Field label="Timezone" hint="All appointment times use this.">
                  <Select
                    value={form.timezone}
                    onChange={(e) => patch({ timezone: e.target.value })}
                  >
                    {[
                      "Europe/Ljubljana", "Europe/Vienna", "Europe/Berlin",
                      "Europe/Zagreb", "Europe/Rome", "Europe/Paris",
                      "Europe/Madrid", "Europe/London", "Europe/Warsaw",
                      "Europe/Athens", "Europe/Helsinki", "America/New_York",
                      "America/Chicago", "America/Los_Angeles", "Australia/Sydney",
                    ].map((tz) => (
                      <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
                    ))}
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Address">
                    <Input
                      value={form.address}
                      onChange={(e) => patch({ address: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </SectionCard>
          )}

          {tab === "branding" && (
            <SectionCard
              title="Branding"
              description="Your logo and brand accent."
              footer={saveBtn(() => persistSettings())}
            >
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-ink-200 dark:border-ink-700 flex items-center justify-center overflow-hidden bg-ink-50 dark:bg-ink-800 shrink-0">
                  {form.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Icon name="image" className="w-7 h-7 text-ink-300" />
                  )}
                </div>
                <div className="flex-1 w-full flex flex-col gap-4">
                  <Field label="Logo URL" hint="Direct link to your logo image.">
                    <Input
                      value={form.logoUrl}
                      onChange={(e) => patch({ logoUrl: e.target.value })}
                      placeholder="https://…/logo.png"
                    />
                  </Field>
                  <Field label="Brand colour" hint="Used for future customer-facing pages.">
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={form.brandColor || "#B99A55"}
                        onChange={(e) => patch({ brandColor: e.target.value })}
                        className="w-10 h-10 rounded-xl border border-ink-200 dark:border-ink-700 cursor-pointer bg-transparent"
                      />
                      <Input
                        value={form.brandColor}
                        onChange={(e) => patch({ brandColor: e.target.value })}
                        className="max-w-[140px]"
                      />
                    </div>
                  </Field>
                </div>
              </div>
            </SectionCard>
          )}

          {tab === "hours" && (
            <div className="flex flex-col gap-6">
              <SectionCard
                title="Working hours"
                description="Your regular weekly schedule."
                footer={saveBtn(() => persistSettings())}
              >
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
                            patch({ hours: { ...form.hours, [day]: { ...h, open: !h.open } } })
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
                                  hours: { ...form.hours, [day]: { ...h, from: e.target.value } },
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
                                  hours: { ...form.hours, [day]: { ...h, to: e.target.value } },
                                })
                              }
                              className="w-28 py-1.5 text-xs"
                            />
                          </div>
                        ) : (
                          <span className="ml-auto text-xs text-ink-300 dark:text-ink-600">Closed</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard
                title="Holidays & closures"
                description="Days you're closed outside the weekly schedule."
                footer={saveBtn(() => persistSettings())}
              >
                <div className="flex gap-2 mb-4">
                  <Input
                    type="date"
                    value={holidayInput}
                    onChange={(e) => setHolidayInput(e.target.value)}
                    className="max-w-[200px]"
                  />
                  <Button
                    variant="secondary"
                    icon="plus"
                    disabled={!holidayInput || form.holidays.includes(holidayInput)}
                    onClick={() => {
                      patch({ holidays: [...form.holidays, holidayInput] });
                      setHolidayInput("");
                    }}
                  >
                    Add
                  </Button>
                </div>
                {holidays.length === 0 ? (
                  <p className="text-sm text-ink-400">No holidays added yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {holidays.map((h) => (
                      <span
                        key={h}
                        className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full border border-ink-200 dark:border-ink-700 text-xs font-semibold text-ink-600 dark:text-ink-300"
                      >
                        {h}
                        <button
                          onClick={() =>
                            patch({ holidays: form.holidays.filter((x) => x !== h) })
                          }
                          className="p-0.5 rounded-full text-ink-300 hover:text-rose-500 transition-colors"
                          aria-label={`Remove ${h}`}
                        >
                          <Icon name="x" className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {tab === "staff" && (
            <SectionCard
              title="Staff members"
              description="Assign appointments to team members and compare workloads in Analytics."
              footer={saveBtn(persistStaff)}
            >
              <div className="flex flex-col gap-3">
                {staffList.map((s, i) => (
                  <div
                    key={i}
                    className="grid sm:grid-cols-[1.4fr_1fr_1fr_auto_auto] grid-cols-2 gap-2 items-center p-3 rounded-xl border border-ink-100 dark:border-ink-800"
                  >
                    <Input
                      value={s.name}
                      placeholder="Full name"
                      onChange={(e) =>
                        setStaffList((l) => l.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))
                      }
                    />
                    <Input
                      value={s.role}
                      placeholder="Role"
                      onChange={(e) =>
                        setStaffList((l) => l.map((x, xi) => (xi === i ? { ...x, role: e.target.value } : x)))
                      }
                    />
                    <Input
                      value={s.phone}
                      placeholder="Phone"
                      onChange={(e) =>
                        setStaffList((l) => l.map((x, xi) => (xi === i ? { ...x, phone: e.target.value } : x)))
                      }
                    />
                    <button
                      onClick={() =>
                        setStaffList((l) => l.map((x, xi) => (xi === i ? { ...x, active: !x.active } : x)))
                      }
                      className="justify-self-start"
                    >
                      <Badge tone={s.active ? "green" : "grey"} dot>
                        {s.active ? "Active" : "Inactive"}
                      </Badge>
                    </button>
                    <button
                      onClick={() => setStaffList((l) => l.filter((_, xi) => xi !== i))}
                      className="p-2 rounded-xl text-ink-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors justify-self-end"
                      aria-label="Remove"
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  icon="plus"
                  onClick={() =>
                    setStaffList((l) => [
                      ...l,
                      { name: "", email: "", phone: "", role: "", color: "", active: true },
                    ])
                  }
                >
                  Add staff member
                </Button>
              </div>
            </SectionCard>
          )}

          {tab === "services" && (
            <SectionCard
              title="Services"
              description="What customers can book, with duration and price."
              footer={saveBtn(persistServices)}
            >
              <div className="flex flex-col gap-3">
                {serviceList.length > 0 && (
                  <div className="hidden sm:grid grid-cols-[1.6fr_0.8fr_0.8fr_auto_auto] gap-2 px-3">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
                      Service name
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
                      Duration (min)
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
                      Price ({form.currency})
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
                      Status
                    </span>
                    <span />
                  </div>
                )}
                {serviceList.map((s, i) => (
                  <div
                    key={i}
                    className="grid sm:grid-cols-[1.6fr_0.8fr_0.8fr_auto_auto] grid-cols-2 gap-2 items-center p-3 rounded-xl border border-ink-100 dark:border-ink-800"
                  >
                    <Input
                      value={s.name}
                      placeholder="Service name"
                      onChange={(e) =>
                        setServiceList((l) => l.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))
                      }
                    />
                    <Input
                      type="number"
                      value={s.duration}
                      placeholder="Min"
                      onChange={(e) =>
                        setServiceList((l) => l.map((x, xi) => (xi === i ? { ...x, duration: e.target.value } : x)))
                      }
                    />
                    <Input
                      type="number"
                      value={s.price}
                      placeholder={`Price (${form.currency})`}
                      onChange={(e) =>
                        setServiceList((l) => l.map((x, xi) => (xi === i ? { ...x, price: e.target.value } : x)))
                      }
                    />
                    <button
                      onClick={() =>
                        setServiceList((l) => l.map((x, xi) => (xi === i ? { ...x, active: !x.active } : x)))
                      }
                      className="justify-self-start"
                    >
                      <Badge tone={s.active ? "green" : "grey"} dot>
                        {s.active ? "Active" : "Hidden"}
                      </Badge>
                    </button>
                    <button
                      onClick={() => setServiceList((l) => l.filter((_, xi) => xi !== i))}
                      className="p-2 rounded-xl text-ink-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors justify-self-end"
                      aria-label="Remove"
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  icon="plus"
                  onClick={() =>
                    setServiceList((l) => [
                      ...l,
                      { name: "", duration: String(form.defaultDuration), price: "", color: "", active: true },
                    ])
                  }
                >
                  Add service
                </Button>
              </div>
            </SectionCard>
          )}

          {tab === "booking" && (
            <SectionCard
              title="Booking preferences"
              description="How new requests behave."
              footer={saveBtn(() => persistSettings())}
            >
              <div className="flex flex-col gap-4 max-w-md">
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
                  description="Customers may cancel confirmed appointments."
                />
                <Toggle
                  checked={form.revenueEnabled}
                  onChange={(v) => patch({ revenueEnabled: v })}
                  label="Track revenue"
                  description="Show revenue stats based on appointment prices."
                />
                <Field
                  label="Booking time slots"
                  hint="How tightly available times are spaced on your booking page and calendar — independent of how long a service actually takes."
                >
                  <div className="flex flex-col gap-3">
                    <Segmented
                      options={[
                        { value: "15", label: "15 min" },
                        { value: "30", label: "30 min" },
                        { value: "60", label: "1 hour" },
                        { value: "custom", label: "Custom" },
                      ]}
                      value={granularityMode}
                      onChange={(v) => {
                        setGranularityMode(v);
                        if (v !== "custom") {
                          patch({ slotGranularityMinutes: Number(v) });
                        }
                      }}
                    />
                    {granularityMode === "custom" && (
                      <Input
                        type="number"
                        min={5}
                        max={120}
                        step={5}
                        value={form.slotGranularityMinutes}
                        placeholder="Minutes"
                        onChange={(e) =>
                          patch({
                            slotGranularityMinutes: Number(e.target.value) || 15,
                          })
                        }
                        className="max-w-[140px]"
                      />
                    )}
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <Field label="Default duration (min)">
                    <Input
                      type="number"
                      min={5}
                      step={5}
                      value={form.defaultDuration}
                      onChange={(e) => patch({ defaultDuration: Number(e.target.value) || 30 })}
                    />
                  </Field>
                  <Field label="Buffer (min)">
                    <Input
                      type="number"
                      min={0}
                      step={5}
                      value={form.bufferMinutes}
                      onChange={(e) => patch({ bufferMinutes: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field
                    label="Booking time slots"
                    hint="How often times are offered on your booking page."
                  >
                    <Select
                      value={String(form.slotGranularityMinutes)}
                      onChange={(e) =>
                        patch({ slotGranularityMinutes: Number(e.target.value) })
                      }
                    >
                      {[5, 10, 15, 20, 30, 60].map((m) => (
                        <option key={m} value={m}>
                          Every {m} min
                        </option>
                      ))}
                    </Select>
                  </Field>
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
                  <Field label="Book up to (days)">
                    <Input
                      type="number"
                      min={1}
                      value={form.maxAdvanceDays}
                      onChange={(e) => patch({ maxAdvanceDays: Number(e.target.value) || 60 })}
                    />
                  </Field>
                </div>
              </div>
            </SectionCard>
          )}

          {tab === "integrations" && <IntegrationsSection />}

          {tab === "notifications" && (
            <SectionCard
              title="Notifications"
              description="Choose what you and your customers receive."
              footer={saveBtn(() => persistSettings())}
            >
              <div className="flex flex-col gap-4 max-w-md">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-300 dark:text-ink-600">
                  Email — to you
                </p>
                <Toggle
                  checked={form.notifyEmailNewRequest}
                  onChange={(v) => patch({ notifyEmailNewRequest: v })}
                  label="New booking requests"
                />
                <Toggle
                  checked={form.notifyEmailCancellation}
                  onChange={(v) => patch({ notifyEmailCancellation: v })}
                  label="Cancellations"
                />
                <Toggle
                  checked={form.notifyEmailDailySummary}
                  onChange={(v) => patch({ notifyEmailDailySummary: v })}
                  label="Daily summary"
                />
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-300 dark:text-ink-600 mt-2">
                  To customers
                </p>
                <Toggle
                  checked={form.notifyEmailConfirmation}
                  onChange={(v) => patch({ notifyEmailConfirmation: v })}
                  label="Email confirmations"
                />
                <Toggle
                  checked={form.notifySmsConfirmation}
                  onChange={(v) => patch({ notifySmsConfirmation: v })}
                  label="SMS confirmations"
                />
                <Toggle
                  checked={form.notifySmsReminder}
                  onChange={(v) => patch({ notifySmsReminder: v })}
                  label="SMS reminders"
                  description={`Sent ${form.reminderHoursBefore}h before the appointment.`}
                />
                <Field label="Reminder timing (hours before)">
                  <Input
                    type="number"
                    min={1}
                    max={72}
                    value={form.reminderHoursBefore}
                    onChange={(e) => patch({ reminderHoursBefore: Number(e.target.value) || 24 })}
                    className="max-w-[140px]"
                  />
                </Field>
              </div>
            </SectionCard>
          )}

          {tab === "security" && (
            <SectionCard
              title="Security"
              description="Your sign-in is protected by Clerk."
            >
              <div className="flex flex-col gap-3 max-w-md">
                <div className="flex items-center gap-3 p-4 rounded-xl border border-ink-100 dark:border-ink-800">
                  <Icon name="shield" className="w-5 h-5 text-gold-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                      Password & two-factor authentication
                    </p>
                    <p className="text-xs text-ink-400 mt-0.5">
                      Change your password, add 2FA, and manage active sessions
                      from your account panel.
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  icon="shield"
                  onClick={() => clerk.openUserProfile()}
                >
                  Open account security
                </Button>
                <p className="text-[11px] text-ink-300 dark:text-ink-600">
                  Signed in as {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </SectionCard>
          )}

          {tab === "billing" && (
            <SectionCard
              title="Subscription & billing"
              description="Your current plan."
            >
              <div className="max-w-md">
                <div className="rounded-2xl border border-gold-200 dark:border-gold-800 bg-gradient-to-br from-gold-50 to-white dark:from-gold-900/20 dark:to-ink-900 p-6">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gold-700 dark:text-gold-300">
                      <Icon name="sparkle" className="w-3.5 h-3.5" />
                      Premium
                    </span>
                    <Badge tone="green" dot>Active</Badge>
                  </div>
                  <p className="text-3xl font-bold text-ink-900 dark:text-ink-50 mt-4">
                    Early access
                  </p>
                  <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
                    All features included while the product is in early access —
                    unlimited appointments, customers, and staff.
                  </p>
                  <ul className="mt-5 flex flex-col gap-2">
                    {[
                      "Unlimited appointments & customers",
                      "Calendar with drag & drop",
                      "Analytics & CSV exports",
                      "Priority support",
                    ].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-ink-600 dark:text-ink-300">
                        <Icon name="check" className="w-4 h-4 text-gold-600 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-[11px] text-ink-300 dark:text-ink-600 mt-3">
                  Invoicing and plan management will appear here when paid plans launch.
                </p>
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}
