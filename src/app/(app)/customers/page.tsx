"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { PageHeader } from "@/components/PageHeader";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  Field,
  Input,
  Segmented,
  Skeleton,
  Textarea,
  Toast,
  statusLabel,
  statusTone,
  useAutoDismiss,
} from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import { longDate } from "@/lib/dates";
import type { Customer } from "@/types/app";

// ── Customer detail drawer ──────────────────────────────────────────────────

function CustomerDrawer({
  customer,
  currency,
  revenueEnabled,
  onClose,
}: {
  customer: Customer;
  currency: Intl.NumberFormat;
  revenueEnabled: boolean;
  onClose: () => void;
}) {
  const { saveCustomerMeta } = useWorkspace();
  const [notes, setNotes] = useState(customer.notes);
  const [tagsText, setTagsText] = useState(customer.tags.join(", "));
  const [vip, setVip] = useState(customer.vip);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useAutoDismiss(toast, () => setToast(null));

  useEffect(() => {
    setNotes(customer.notes);
    setTagsText(customer.tags.join(", "));
    setVip(customer.vip);
  }, [customer]);

  const dirty =
    notes !== customer.notes ||
    tagsText !== customer.tags.join(", ") ||
    vip !== customer.vip;

  async function save() {
    setSaving(true);
    try {
      await saveCustomerMeta({
        email: customer.email,
        phone: customer.phone,
        tags: tagsText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        vip,
        notes,
      });
      setToast("Customer saved");
    } catch {
      setToast("Couldn't save — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open onClose={onClose}>
      <div className="p-6">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={customer.name} size="lg" />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-ink-900 dark:text-ink-50 truncate flex items-center gap-2">
                {customer.name}
                {vip && (
                  <Icon name="star" className="w-4 h-4 text-gold-500 shrink-0" />
                )}
              </h2>
              <p className="text-xs text-ink-400 truncate">{customer.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-ink-400 hover:text-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors shrink-0"
            aria-label="Close"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        {/* Lifetime stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="rounded-xl bg-ink-50 dark:bg-ink-800 p-3 text-center">
            <p className="text-xl font-bold text-ink-900 dark:text-ink-50">
              {customer.totalBookings}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400 mt-0.5">
              Bookings
            </p>
          </div>
          <div className="rounded-xl bg-ink-50 dark:bg-ink-800 p-3 text-center">
            <p className="text-xl font-bold text-emerald-600">
              {customer.confirmed}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400 mt-0.5">
              Confirmed
            </p>
          </div>
          <div className="rounded-xl bg-ink-50 dark:bg-ink-800 p-3 text-center">
            <p className="text-xl font-bold text-gold-600">
              {revenueEnabled ? currency.format(customer.lifetimeValue) : "—"}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400 mt-0.5">
              Lifetime value
            </p>
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <a
            href={`mailto:${customer.email}`}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 text-sm font-semibold text-ink-700 dark:text-ink-200 hover:border-gold-300 hover:bg-gold-50/50 dark:hover:bg-gold-900/10 transition-all"
          >
            <Icon name="mail" className="w-4 h-4 text-gold-600" /> Email
          </a>
          <a
            href={customer.phone ? `tel:${customer.phone}` : undefined}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-ink-200 dark:border-ink-700 text-sm font-semibold text-ink-700 dark:text-ink-200 transition-all ${
              customer.phone
                ? "hover:border-gold-300 hover:bg-gold-50/50 dark:hover:bg-gold-900/10"
                : "opacity-50 cursor-default"
            }`}
          >
            <Icon name="phone" className="w-4 h-4 text-gold-600" />
            {customer.phone || "No phone"}
          </a>
        </div>

        {/* Editable meta */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-ink-200 dark:border-ink-700">
            <div className="flex items-center gap-2.5">
              <Icon name="star" className={`w-4 h-4 ${vip ? "text-gold-500" : "text-ink-300"}`} />
              <div>
                <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                  VIP customer
                </p>
                <p className="text-[11px] text-ink-400">
                  Pinned to the top of your customer list
                </p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={vip}
              onClick={() => setVip((v) => !v)}
              className={`relative shrink-0 w-10 h-6 rounded-full transition-colors duration-300 ${
                vip ? "bg-gold-500" : "bg-ink-200 dark:bg-ink-700"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-spring ${
                  vip ? "translate-x-4" : ""
                }`}
              />
            </button>
          </div>

          <Field label="Tags" hint="Separate with commas — e.g. regular, colour, sensitive skin">
            <Input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="regular, prefers-morning"
            />
          </Field>

          <Field label="Private notes">
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Preferences, history, anything worth remembering…"
            />
          </Field>

          <Button
            variant="primary"
            loading={saving}
            disabled={!dirty}
            onClick={save}
          >
            Save customer
          </Button>
        </div>

        {/* History */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-300 dark:text-ink-600 mb-3">
          Appointment history
        </p>
        <div className="flex flex-col">
          {customer.bookings.map((b) => (
            <div
              key={b.rowIndex}
              className="flex items-center gap-3 py-2.5 border-b border-ink-50 dark:border-ink-800/60 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                  {b.Datum} <span className="text-ink-400 font-normal">at {b.Ura}</span>
                </p>
                {b.Service && (
                  <p className="text-xs text-ink-400 truncate">{b.Service}</p>
                )}
              </div>
              <Badge tone={statusTone(b.Status)}>{statusLabel(b.Status)}</Badge>
            </div>
          ))}
        </div>
      </div>
      <Toast message={toast} />
    </Drawer>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

type CustomerFilter = "all" | "vip" | "repeat" | "new";

function CustomersContent() {
  const params = useSearchParams();
  const { customers, settings, loading, error, refresh } = useWorkspace();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [openEmail, setOpenEmail] = useState<string | null>(null);

  useEffect(() => {
    const q = params.get("q");
    if (q !== null) setQuery(q);
  }, [params]);

  const currency = useMemo(() => {
    try {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: settings.currency || "EUR",
        maximumFractionDigits: 0,
      });
    } catch {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      });
    }
  }, [settings.currency]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );
    return customers.filter((c) => {
      if (q) {
        const hay =
          `${c.name} ${c.email} ${c.phone} ${c.tags.join(" ")} ${c.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "vip" && !c.vip) return false;
      if (filter === "repeat" && c.totalBookings < 2) return false;
      if (filter === "new" && (!c.firstBooking || c.firstBooking < monthStart))
        return false;
      return true;
    });
  }, [customers, query, filter]);

  const open = customers.find((c) => c.email === openEmail) ?? null;

  if (error) {
    return (
      <EmptyState
        icon="x"
        title="Couldn't load customers"
        description={error}
        action={
          <Button variant="primary" icon="refresh" onClick={refresh}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={
          loading
            ? "Loading…"
            : `${customers.length} ${customers.length === 1 ? "customer" : "customers"} · ${customers.filter((c) => c.vip).length} VIP`
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6 animate-fade-up">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Icon
            name="search"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, phone, tags…"
            className="pl-10"
          />
        </div>
        <Segmented
          options={[
            { value: "all", label: "All" },
            { value: "vip", label: "VIP" },
            { value: "repeat", label: "Repeat" },
            { value: "new", label: "New this month" },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5">
              <div className="flex gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="w-32 h-4" />
                  <Skeleton className="w-44 h-3 mt-2" />
                </div>
              </div>
              <Skeleton className="w-full h-12 mt-4" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="users"
            title={query || filter !== "all" ? "No customers match" : "No customers yet"}
            description={
              query || filter !== "all"
                ? "Try a different search or filter."
                : "Customers are created automatically from booking requests."
            }
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c, i) => (
            <Card
              key={c.email}
              hover
              className="p-5 cursor-pointer animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
              onClick={() => setOpenEmail(c.email)}
            >
              <div className="flex items-start gap-3">
                <Avatar name={c.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-bold text-ink-900 dark:text-ink-50 truncate flex items-center gap-1.5">
                    {c.name}
                    {c.vip && (
                      <Icon name="star" className="w-3.5 h-3.5 text-gold-500 shrink-0" />
                    )}
                  </h3>
                  <p className="text-xs text-ink-400 truncate">{c.email}</p>
                  {c.phone && (
                    <p className="text-xs text-ink-400 truncate">{c.phone}</p>
                  )}
                </div>
              </div>

              {c.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {c.tags.slice(0, 4).map((t) => (
                    <Badge key={t} tone="gold">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-ink-50 dark:border-ink-800 text-xs">
                <span className="text-ink-400">
                  <span className="font-bold text-ink-900 dark:text-ink-50">
                    {c.totalBookings}
                  </span>{" "}
                  booking{c.totalBookings === 1 ? "" : "s"}
                </span>
                {settings.revenueEnabled && c.lifetimeValue > 0 && (
                  <span className="font-bold text-gold-600">
                    {currency.format(c.lifetimeValue)}
                  </span>
                )}
                {c.lastBooking && (
                  <span className="text-ink-300 dark:text-ink-500">
                    Last: {longDate(c.lastBooking)}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <CustomerDrawer
          customer={open}
          currency={currency}
          revenueEnabled={settings.revenueEnabled}
          onClose={() => setOpenEmail(null)}
        />
      )}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={null}>
      <CustomersContent />
    </Suspense>
  );
}
