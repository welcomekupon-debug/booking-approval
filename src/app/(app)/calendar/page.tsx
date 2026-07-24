"use client";

/**
 * Calendar — day / week / month views with drag-and-drop rescheduling.
 *
 * Sync-ready architecture: every event carries a stable Bookingid and an
 * UpdatedAt timestamp, and all mutations flow through PATCH /api/bookings/[id].
 * An external calendar adapter (Google/Outlook) can subscribe to the same
 * endpoint and reconcile by Bookingid without any UI changes.
 */

import { useMemo, useState, type CSSProperties, type DragEvent } from "react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { PageHeader } from "@/components/PageHeader";
import { AppointmentDrawer } from "@/components/appointments/AppointmentDrawer";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Segmented,
  Skeleton,
  Toast,
  useAutoDismiss,
} from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import {
  addDays,
  bookingDateTime,
  isSameDay,
  minutesToLabel,
  monthLabel,
  parseTime,
  shortDate,
  startOfDay,
  startOfWeek,
  toSheetDate,
} from "@/lib/dates";
import { normStatus } from "@/lib/stats";
import type { Booking } from "@/types/booking";

type View = "day" | "week" | "month";

const DAY_START = 0; // 00:00
const DAY_END = 24 * 60; // 24:00
const PX_PER_MIN = 56 / 60; // 56px per hour

const STATUS_CHIP: Record<string, string> = {
  confirmed:
    "bg-emerald-500/90 text-white border-emerald-600 hover:bg-emerald-500",
  pending: "bg-amber-400/90 text-amber-950 border-amber-500 hover:bg-amber-400",
  declined:
    "bg-ink-200 dark:bg-ink-700 text-ink-500 dark:text-ink-400 border-ink-300 dark:border-ink-600 line-through opacity-70",
  cancelled:
    "bg-ink-200 dark:bg-ink-700 text-ink-500 dark:text-ink-400 border-ink-300 dark:border-ink-600 line-through opacity-70",
};

function chipClass(status: string) {
  return STATUS_CHIP[status] ?? "bg-ink-400 text-white border-ink-500";
}

const STATUS_DOT: Record<string, string> = {
  confirmed: "#10b981", // emerald-500
  pending: "#f59e0b", // amber-500
  declined: "#9ca3af", // gray-400
  cancelled: "#9ca3af",
};

/** "#RRGGBB" → "rgba(r,g,b,a)"; passthrough-safe for anything else. */
function hexToRgba(hex: string, alpha: number): string | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * When a service has a calendar colour set, it takes over the chip's look
 * (tinted background + coloured left edge) with a small status dot so
 * pending/declined/cancelled are still visible at a glance. Services left
 * uncoloured fall back to the original status-only styling.
 */
function chipAppearance(
  status: string,
  serviceColor?: string
): { className: string; style?: CSSProperties } {
  const tint = serviceColor ? hexToRgba(serviceColor, 0.16) : null;
  const border = serviceColor ? hexToRgba(serviceColor, 0.4) : null;
  if (!tint || !border) {
    return { className: chipClass(status) };
  }
  const muted = status === "declined" || status === "cancelled";
  return {
    className: `border-l-4 text-ink-800 dark:text-ink-50 ${
      muted ? "line-through opacity-60" : ""
    }`,
    style: {
      backgroundColor: tint,
      borderColor: border,
      borderLeftColor: serviceColor,
    },
  };
}

interface DropPayload {
  date: Date;
  minutes?: number; // undefined = keep original time (month view)
}

export default function CalendarPage() {
  const { bookings, services, settings, loading, error, refresh, updateBooking } =
    useWorkspace();

  const serviceColorById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of services) {
      if (s.id && s.color) map[s.id] = s.color;
    }
    return map;
  }, [services]);

  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [query, setQuery] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [dragRow, setDragRow] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useAutoDismiss(toast, () => setToast(null));

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) =>
      `${b.Ime} ${b.Gmail} ${b.Service} ${b.Staff} ${b.Notes}`
        .toLowerCase()
        .includes(q)
    );
  }, [bookings, query]);

  const eventsOn = useMemo(() => {
    return (day: Date) =>
      visible
        .filter((b) => {
          const d = bookingDateTime(b.Datum, b.Ura);
          return d !== null && isSameDay(d, day);
        })
        .sort(
          (a, b) => (parseTime(a.Ura) ?? 0) - (parseTime(b.Ura) ?? 0)
        );
  }, [visible]);

  const openBooking = bookings.find((b) => b.id === openRow) ?? null;

  // ── Navigation ────────────────────────────────────────────────────────────

  function navigate(dir: -1 | 1) {
    if (view === "day") setCursor((c) => addDays(c, dir));
    else if (view === "week") setCursor((c) => addDays(c, dir * 7));
    else
      setCursor(
        (c) => new Date(c.getFullYear(), c.getMonth() + dir, 1)
      );
  }

  const rangeLabel = useMemo(() => {
    if (view === "day") return shortDate(cursor) + `, ${cursor.getFullYear()}`;
    if (view === "week") {
      const ws = startOfWeek(cursor);
      const we = addDays(ws, 6);
      return `${shortDate(ws)} – ${shortDate(we)}`;
    }
    return monthLabel(cursor);
  }, [view, cursor]);

  // ── Drag & drop ───────────────────────────────────────────────────────────

  function onDragStart(e: DragEvent, b: Booking) {
    setDragRow(b.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(b.id));
  }

  async function onDrop(payload: DropPayload) {
    setDropKey(null);
    const row = dragRow;
    setDragRow(null);
    if (row === null) return;

    const booking = bookings.find((b) => b.id === row);
    if (!booking) return;

    const newDatum = toSheetDate(payload.date);
    const newUra =
      payload.minutes !== undefined
        ? minutesToLabel(payload.minutes).padStart(5, "0")
        : undefined;

    if (newDatum === booking.Datum && (newUra === undefined || newUra === booking.Ura)) {
      return;
    }

    try {
      await updateBooking(row, { datum: newDatum, ura: newUra });
      setToast(
        `${booking.Ime} moved to ${newDatum}${newUra ? ` at ${newUra}` : ""}`
      );
    } catch {
      setToast("Couldn't reschedule — please try again");
    }
  }

  function allowDrop(e: DragEvent, key: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropKey !== key) setDropKey(key);
  }

  // ── Event chip (shared) ───────────────────────────────────────────────────

  function EventChip({
    b,
    style,
    compact = false,
  }: {
    b: Booking;
    style?: CSSProperties;
    compact?: boolean;
  }) {
    const status = normStatus(b);
    const serviceColor = b.ServiceId ? serviceColorById[b.ServiceId] : undefined;
    const appearance = chipAppearance(status, serviceColor);
    return (
      <button
        draggable
        onDragStart={(e) => onDragStart(e, b)}
        onDragEnd={() => {
          setDragRow(null);
          setDropKey(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          setOpenRow(b.id);
        }}
        style={{ ...style, ...appearance.style }}
        title={`${b.Ime}${b.Service ? ` · ${b.Service}` : ""} · ${b.Ura}${b.Staff ? ` · ${b.Staff}` : ""}`}
        className={`group/event text-left border rounded-lg px-2 py-1 text-[11px] font-semibold leading-tight truncate cursor-grab active:cursor-grabbing transition-all duration-150 shadow-sm hover:shadow-md hover:z-20 ${appearance.className} ${
          dragRow === b.id ? "dragging" : ""
        }`}
      >
        {appearance.style && (
          <span
            className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
            style={{ backgroundColor: STATUS_DOT[status] ?? STATUS_DOT.declined }}
          />
        )}
        {!compact && <span className="opacity-80">{b.Ura} </span>}
        {b.Ime}
        {!compact && b.Service && (
          <span className="hidden sm:inline opacity-80"> · {b.Service}</span>
        )}
      </button>
    );
  }

  // ── Time-grid views (day + week) ──────────────────────────────────────────

  function TimeGrid({ days }: { days: Date[] }) {
    const hours: number[] = [];
    for (let m = DAY_START; m < DAY_END; m += 60) hours.push(m);
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    return (
      <div className="flex overflow-x-auto">
        {/* Hour labels */}
        <div className="w-14 shrink-0 pt-10">
          {hours.map((m) => (
            <div
              key={m}
              className="relative text-right pr-2"
              style={{ height: 60 * PX_PER_MIN }}
            >
              <span className="absolute -top-2 right-2 text-[10px] font-semibold text-ink-300 dark:text-ink-600">
                {minutesToLabel(m)}
              </span>
            </div>
          ))}
        </div>

        {days.map((day) => {
          const events = eventsOn(day);
          const isToday = isSameDay(day, now);
          return (
            <div
              key={day.toISOString()}
              className="flex-1 min-w-[110px] border-l border-ink-100 dark:border-ink-800"
            >
              {/* Column header */}
              <div
                className={`h-10 flex items-center justify-center gap-1.5 text-xs font-bold sticky top-0 ${
                  isToday
                    ? "text-gold-600"
                    : "text-ink-500 dark:text-ink-400"
                }`}
              >
                {day.toLocaleDateString("en-GB", { weekday: "short" })}
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isToday ? "bg-gold-500 text-white" : ""
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Slots */}
              <div className="relative">
                {hours.map((m) => {
                  const key = `${day.toDateString()}-${m}`;
                  const keyHalf = `${day.toDateString()}-${m + 30}`;
                  return (
                    <div
                      key={m}
                      className="border-t border-ink-100 dark:border-ink-800"
                      style={{ height: 60 * PX_PER_MIN }}
                    >
                      <div
                        className={`h-1/2 ${dropKey === key ? "drop-target rounded-md" : ""}`}
                        onDragOver={(e) => allowDrop(e, key)}
                        onDragLeave={() => setDropKey((k) => (k === key ? null : k))}
                        onDrop={(e) => {
                          e.preventDefault();
                          onDrop({ date: day, minutes: m });
                        }}
                      />
                      <div
                        className={`h-1/2 ${dropKey === keyHalf ? "drop-target rounded-md" : ""}`}
                        onDragOver={(e) => allowDrop(e, keyHalf)}
                        onDragLeave={() =>
                          setDropKey((k) => (k === keyHalf ? null : k))
                        }
                        onDrop={(e) => {
                          e.preventDefault();
                          onDrop({ date: day, minutes: m + 30 });
                        }}
                      />
                    </div>
                  );
                })}

                {/* Now indicator */}
                {isToday && nowMins >= DAY_START && nowMins <= DAY_END && (
                  <div
                    className="absolute left-0 right-0 z-10 pointer-events-none"
                    style={{ top: (nowMins - DAY_START) * PX_PER_MIN }}
                  >
                    <div className="h-0.5 bg-rose-500" />
                    <div className="w-2 h-2 rounded-full bg-rose-500 -mt-[5px]" />
                  </div>
                )}

                {/* Events */}
                {events.map((b) => {
                  const mins = parseTime(b.Ura);
                  if (mins === null || mins < DAY_START || mins > DAY_END) {
                    return null;
                  }
                  const dur =
                    parseInt(b.Duration, 10) || settings.defaultDuration || 30;
                  return (
                    <EventChip
                      key={b.id}
                      b={b}
                      style={{
                        position: "absolute",
                        top: (mins - DAY_START) * PX_PER_MIN,
                        height: Math.max(22, dur * PX_PER_MIN - 2),
                        left: 3,
                        right: 3,
                        overflow: "hidden",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Month view ────────────────────────────────────────────────────────────

  function MonthGrid() {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const weeks: Date[][] = [];
    let d = gridStart;
    for (let w = 0; w < 6; w++) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(d);
        d = addDays(d, 1);
      }
      weeks.push(week);
      if (d.getMonth() !== cursor.getMonth() && d.getDay() === 1 && w >= 4) break;
    }
    const now = new Date();

    return (
      <div>
        <div className="grid grid-cols-7 border-b border-ink-100 dark:border-ink-800">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
            <div
              key={w}
              className="py-2 text-center text-[11px] font-bold uppercase tracking-wide text-ink-400"
            >
              {w}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className="grid grid-cols-7 border-b border-ink-100 dark:border-ink-800 last:border-0"
          >
            {week.map((day) => {
              const events = eventsOn(day);
              const inMonth = day.getMonth() === cursor.getMonth();
              const isToday = isSameDay(day, now);
              const key = `m-${day.toDateString()}`;
              return (
                <div
                  key={key}
                  className={`min-h-[108px] p-1.5 border-r border-ink-100 dark:border-ink-800 last:border-r-0 transition-colors ${
                    inMonth ? "" : "bg-ink-50/50 dark:bg-ink-800/20"
                  } ${dropKey === key ? "drop-target" : ""}`}
                  onDragOver={(e) => allowDrop(e, key)}
                  onDragLeave={() => setDropKey((k) => (k === key ? null : k))}
                  onDrop={(e) => {
                    e.preventDefault();
                    onDrop({ date: day });
                  }}
                  onClick={() => {
                    setCursor(startOfDay(day));
                    setView("day");
                  }}
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mb-1 ${
                      isToday
                        ? "bg-gold-500 text-white"
                        : inMonth
                          ? "text-ink-700 dark:text-ink-200"
                          : "text-ink-300 dark:text-ink-600"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="flex flex-col gap-1">
                    {events.slice(0, 3).map((b) => (
                      <EventChip key={b.id} b={b} />
                    ))}
                    {events.length > 3 && (
                      <button
                        className="text-[10px] font-bold text-gold-600 hover:text-gold-700 text-left px-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCursor(startOfDay(day));
                          setView("day");
                        }}
                      >
                        +{events.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <EmptyState
        icon="x"
        title="Couldn't load the calendar"
        description={error}
        action={
          <Button variant="primary" icon="refresh" onClick={refresh}>
            Try again
          </Button>
        }
      />
    );
  }

  const weekDays =
    view === "week"
      ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))
      : [cursor];

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Drag an appointment to reschedule it — changes save instantly."
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            loading={refreshing}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        }
      />

      {/* Toolbar */}
      <Card className="mb-4 p-3 flex flex-wrap items-center gap-3 animate-fade-up">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Previous">
            <Icon name="chevronLeft" className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCursor(startOfDay(new Date()))}
          >
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(1)} aria-label="Next">
            <Icon name="chevronRight" className="w-4 h-4" />
          </Button>
        </div>

        <h2 className="text-sm font-bold text-ink-900 dark:text-ink-50 min-w-[160px]">
          {rangeLabel}
        </h2>

        <div className="relative ml-auto min-w-[180px] max-w-xs flex-1">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search calendar…"
            className="pl-9 py-2 text-xs"
          />
        </div>

        <Segmented
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
          value={view}
          onChange={setView}
        />
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 px-1 text-[11px] font-semibold text-ink-400 animate-fade-up">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Confirmed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Pending
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-ink-300 dark:bg-ink-600" /> Declined
        </span>
      </div>

      <Card className="overflow-hidden animate-fade-up">
        {loading ? (
          <div className="p-6">
            <Skeleton className="w-full h-[480px]" />
          </div>
        ) : view === "month" ? (
          <MonthGrid />
        ) : (
          <TimeGrid days={weekDays} />
        )}
      </Card>

      {openBooking && (
        <AppointmentDrawer booking={openBooking} onClose={() => setOpenRow(null)} />
      )}

      <Toast message={toast} />
    </div>
  );
}
