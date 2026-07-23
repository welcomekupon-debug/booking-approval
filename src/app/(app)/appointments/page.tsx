"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { PageHeader } from "@/components/PageHeader";
import { AppointmentDrawer } from "@/components/appointments/AppointmentDrawer";
import { NewAppointmentModal } from "@/components/appointments/NewAppointmentModal";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmailLink,
  EmptyState,
  Input,
  PhoneLink,
  Segmented,
  Skeleton,
  Toast,
  statusLabel,
  statusTone,
  useAutoDismiss,
} from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import { filterBookings } from "@/lib/filterBookings";
import { bookingDateTime } from "@/lib/dates";
import { normStatus } from "@/lib/stats";
import type { Booking, DateFilter, StatusFilter } from "@/types/booking";

// ── Saved filters (localStorage) ────────────────────────────────────────────

interface SavedFilter {
  name: string;
  query: string;
  status: StatusFilter;
  date: DateFilter;
}

const SAVED_KEY = "appointments-saved-filters";

function loadSaved(): SavedFilter[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

// ── Appointment card ────────────────────────────────────────────────────────

function AppointmentCard({
  booking,
  onOpen,
  onDecide,
  acting,
  index,
}: {
  booking: Booking;
  onOpen: () => void;
  onDecide: (status: "Confirmed" | "Declined") => void;
  acting: boolean;
  index: number;
}) {
  const status = normStatus(booking);

  return (
    <Card
      hover
      className="p-5 flex flex-col gap-4 cursor-pointer animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
      onClick={onOpen}
    >
      <div className="flex items-start gap-3">
        <Avatar name={booking.Ime} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-bold text-ink-900 dark:text-ink-50 truncate">
              {booking.Ime}
            </h3>
            <Badge tone={statusTone(booking.Status)} dot>
              {statusLabel(booking.Status)}
            </Badge>
          </div>
          <EmailLink
            email={booking.Gmail}
            stopPropagation
            className="block text-xs text-ink-400 truncate mt-0.5 hover:text-gold-600 hover:underline"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        <span className="flex items-center gap-2 text-ink-600 dark:text-ink-300">
          <Icon name="calendar" className="w-3.5 h-3.5 text-gold-600 shrink-0" />
          {booking.Datum || "—"}
        </span>
        <span className="flex items-center gap-2 text-ink-600 dark:text-ink-300">
          <Icon name="clock" className="w-3.5 h-3.5 text-gold-600 shrink-0" />
          {booking.Ura || "—"}
          {booking.Duration && (
            <span className="text-ink-400">· {booking.Duration} min</span>
          )}
        </span>
        {booking.Service && (
          <span className="flex items-center gap-2 text-ink-600 dark:text-ink-300 col-span-2 truncate">
            <Icon name="tag" className="w-3.5 h-3.5 text-gold-600 shrink-0" />
            <span className="truncate">{booking.Service}</span>
            {booking.Staff && (
              <span className="text-ink-400 truncate">with {booking.Staff}</span>
            )}
          </span>
        )}
        {booking.Phone && (
          <PhoneLink
            phone={booking.Phone}
            stopPropagation
            className="flex items-center gap-2 text-ink-600 dark:text-ink-300 col-span-2 hover:text-gold-600"
          >
            <Icon name="phone" className="w-3.5 h-3.5 text-gold-600 shrink-0" />
            {booking.Phone}
          </PhoneLink>
        )}
        {booking.Notes && (
          <span className="flex items-start gap-2 text-ink-500 dark:text-ink-400 col-span-2 text-xs">
            <Icon name="note" className="w-3.5 h-3.5 text-gold-600 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{booking.Notes}</span>
          </span>
        )}
      </div>

      <div
        className="flex gap-2 mt-auto pt-1"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "pending" ? (
          <>
            <Button
              size="sm"
              variant="success"
              icon="check"
              className="flex-1"
              loading={acting}
              onClick={() => onDecide("Confirmed")}
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon="x"
              className="flex-1"
              disabled={acting}
              onClick={() => onDecide("Declined")}
            >
              Decline
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" icon="edit" className="flex-1" onClick={onOpen}>
            Details
          </Button>
        )}
        <EmailLink
          email={booking.Gmail}
          stopPropagation
          className="p-2 rounded-xl border border-ink-200 dark:border-ink-700 text-ink-500 hover:text-gold-600 hover:border-gold-300 transition-colors"
          aria-label={`Email ${booking.Ime}`}
        >
          <Icon name="mail" className="w-4 h-4" />
        </EmailLink>
      </div>
    </Card>
  );
}

// ── Page content ────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "declined", label: "Declined" },
];

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "upcoming", label: "Upcoming" },
];

function AppointmentsContent() {
  const params = useSearchParams();
  const { bookings, loading, error, refresh, updateBooking } = useWorkspace();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<StatusFilter>(
    (params.get("status") as StatusFilter) || "all"
  );
  const [date, setDate] = useState<DateFilter>(
    (params.get("date") as DateFilter) || "all"
  );
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedFilter[]>([]);
  const [newOpen, setNewOpen] = useState(false);

  useAutoDismiss(toast, () => setToast(null));

  useEffect(() => {
    setSaved(loadSaved());
  }, []);

  // Sync when arriving via links (e.g. from notifications / command palette)
  useEffect(() => {
    const q = params.get("q");
    const s = params.get("status") as StatusFilter | null;
    if (q !== null) setQuery(q);
    if (s) setStatus(s);
  }, [params]);

  const filtered = useMemo(() => {
    const list = filterBookings(bookings, query, status, date);
    return [...list].sort((a, b) => {
      // Pending first, then soonest date
      const pa = normStatus(a) === "pending" ? 0 : 1;
      const pb = normStatus(b) === "pending" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const da = bookingDateTime(a.Datum, a.Ura)?.getTime() ?? Infinity;
      const db = bookingDateTime(b.Datum, b.Ura)?.getTime() ?? Infinity;
      return da - db;
    });
  }, [bookings, query, status, date]);

  const isFiltered = query !== "" || status !== "all" || date !== "all";
  const openBooking = bookings.find((b) => b.id === openRow) ?? null;

  async function decide(id: string, next: "Confirmed" | "Declined") {
    setActing(id);
    try {
      await updateBooking(id, { status: next });
      setToast(next === "Confirmed" ? "Appointment confirmed" : "Appointment declined");
    } catch {
      setToast("Something went wrong — please try again");
    } finally {
      setActing(null);
    }
  }

  function saveCurrentFilter() {
    const name = window.prompt("Name this filter:", "");
    if (!name?.trim()) return;
    const next = [
      ...saved.filter((f) => f.name !== name.trim()),
      { name: name.trim(), query, status, date },
    ];
    setSaved(next);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setToast("Filter saved");
  }

  function removeSavedFilter(name: string) {
    const next = saved.filter((f) => f.name !== name);
    setSaved(next);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  }

  if (error) {
    return (
      <EmptyState
        icon="x"
        title="Couldn't load appointments"
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
        title="Appointments"
        subtitle={
          loading
            ? "Loading…"
            : `${filtered.length} ${filtered.length === 1 ? "appointment" : "appointments"}${isFiltered ? " matching filters" : ""}`
        }
        actions={
          <>
            <Button variant="secondary" icon="refresh" onClick={refresh}>
              Refresh
            </Button>
            <Button variant="gold" icon="plus" onClick={() => setNewOpen(true)}>
              New appointment
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6 animate-fade-up">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Icon
              name="search"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, phone, service, notes…"
              className="pl-10"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 transition-colors"
                aria-label="Clear search"
              >
                <Icon name="x" className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Segmented options={STATUS_OPTIONS} value={status} onChange={setStatus} />
          <Segmented options={DATE_OPTIONS} value={date} onChange={setDate} />
        </div>

        {/* Saved filters */}
        <div className="flex flex-wrap items-center gap-2">
          {saved.map((f) => (
            <span
              key={f.name}
              className="group inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-xs font-semibold text-ink-600 dark:text-ink-300 hover:border-gold-300 transition-colors"
            >
              <button
                onClick={() => {
                  setQuery(f.query);
                  setStatus(f.status);
                  setDate(f.date);
                }}
              >
                {f.name}
              </button>
              <button
                onClick={() => removeSavedFilter(f.name)}
                className="p-0.5 rounded-full text-ink-300 hover:text-rose-500 transition-colors"
                aria-label={`Delete filter ${f.name}`}
              >
                <Icon name="x" className="w-3 h-3" />
              </button>
            </span>
          ))}
          {isFiltered && (
            <button
              onClick={saveCurrentFilter}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gold-600 hover:text-gold-700 transition-colors px-2 py-1"
            >
              <Icon name="star" className="w-3.5 h-3.5" />
              Save current filter
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5">
              <div className="flex gap-3">
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="w-32 h-4" />
                  <Skeleton className="w-44 h-3 mt-2" />
                </div>
              </div>
              <Skeleton className="w-full h-16 mt-4" />
              <Skeleton className="w-full h-9 mt-4" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={isFiltered ? "search" : "clipboard"}
            title={isFiltered ? "No appointments match" : "No appointments yet"}
            description={
              isFiltered
                ? "Try adjusting your search or filters."
                : "New booking requests from your customers will appear here."
            }
            action={
              isFiltered ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setStatus("all");
                    setDate("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((b, i) => (
            <AppointmentCard
              key={b.id}
              booking={b}
              index={i}
              acting={acting === b.id}
              onOpen={() => setOpenRow(b.id)}
              onDecide={(s) => decide(b.id, s)}
            />
          ))}
        </div>
      )}

      {openBooking && (
        <AppointmentDrawer booking={openBooking} onClose={() => setOpenRow(null)} />
      )}

      <NewAppointmentModal open={newOpen} onClose={() => setNewOpen(false)} />

      <Toast message={toast} />
    </div>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={null}>
      <AppointmentsContent />
    </Suspense>
  );
}
