"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { PageHeader } from "@/components/PageHeader";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Segmented,
  Skeleton,
  statusLabel,
  statusTone,
} from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";
import { AreaChart, BarChart, DonutChart } from "@/components/ui/charts";
import {
  bookingsByHour,
  bookingsPerDay,
  computeDashboardStats,
  normStatus,
  type TrendStat,
} from "@/lib/stats";
import { getRecentActivity } from "@/lib/activity";
import { formatRelativeTime } from "@/lib/relativeTime";
import { bookingDateTime, isSameDay, longDate } from "@/lib/dates";

// ── Stat card ───────────────────────────────────────────────────────────────

function Trend({ trend }: { trend: TrendStat }) {
  if (trend.delta === null) return null;
  const up = trend.delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
        up
          ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/30"
          : "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-900/30"
      }`}
    >
      <Icon name={up ? "trendUp" : "trendDown"} className="w-3 h-3" />
      {Math.abs(trend.delta)}%
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
  trend,
  hint,
  accent = false,
  delay = 0,
  href,
}: {
  label: string;
  value: string | number;
  icon: IconName;
  trend?: TrendStat;
  hint?: string;
  accent?: boolean;
  delay?: number;
  href?: string;
}) {
  const body = (
    <Card
      hover
      className={`p-5 animate-fade-up h-full ${href ? "cursor-pointer" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            accent
              ? "bg-gold-500 text-white"
              : "bg-ink-50 dark:bg-ink-800 text-gold-600 dark:text-gold-400"
          }`}
        >
          <Icon name={icon} className="w-[18px] h-[18px]" />
        </span>
        {trend && <Trend trend={trend} />}
      </div>
      <p className="text-3xl font-bold text-ink-900 dark:text-ink-50 mt-4 stat-value tracking-tight">
        {value}
      </p>
      <p className="text-[12px] font-semibold text-ink-400 mt-1 uppercase tracking-wide">
        {label}
      </p>
      {hint && <p className="text-[11px] text-ink-300 dark:text-ink-500 mt-0.5">{hint}</p>}
    </Card>
  );

  if (!href) return body;

  return (
    <Link
      href={href}
      className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
      aria-label={`View ${label} in ${href.startsWith("/appointments") ? "Appointments" : href.startsWith("/calendar") ? "Calendar" : href.startsWith("/customers") ? "Customers" : href.startsWith("/analytics") ? "Analytics" : "app"}`}
    >
      {body}
    </Link>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useUser();
  const { bookings, settings, loading, error, refresh, updateBooking } =
    useWorkspace();
  const [range, setRange] = useState<"30" | "90">("30");
  const [acting, setActing] = useState<string | null>(null);

  const stats = useMemo(() => computeDashboardStats(bookings), [bookings]);
  const series = useMemo(
    () => bookingsPerDay(bookings, range === "30" ? 30 : 90),
    [bookings, range]
  );
  const hours = useMemo(() => bookingsByHour(bookings), [bookings]);
  const activity = useMemo(() => getRecentActivity(bookings, 8), [bookings]);

  const todaysSchedule = useMemo(() => {
    const now = new Date();
    return bookings
      .filter((b) => {
        const s = normStatus(b);
        if (s === "declined" || s === "cancelled") return false;
        const d = bookingDateTime(b.Datum, b.Ura);
        return d !== null && isSameDay(d, now);
      })
      .sort(
        (a, b) =>
          (bookingDateTime(a.Datum, a.Ura)?.getTime() ?? 0) -
          (bookingDateTime(b.Datum, b.Ura)?.getTime() ?? 0)
      );
  }, [bookings]);

  const pendingPreview = useMemo(
    () => bookings.filter((b) => normStatus(b) === "pending").slice(0, 3),
    [bookings]
  );

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

  async function quickDecide(id: string, status: "Confirmed" | "Declined") {
    setActing(id);
    try {
      await updateBooking(id, { status });
    } finally {
      setActing(null);
    }
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  if (error) {
    return (
      <EmptyState
        icon="x"
        title="Couldn't load your workspace"
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
        title={`${greeting}${user?.firstName ? `, ${user.firstName}` : ""}`}
        subtitle={longDate(new Date())}
        actions={
          <>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800 transition-all duration-200"
            >
              <Icon name="calendar" className="w-4 h-4" />
              Calendar
            </Link>
            {stats.pending > 0 && (
              <Link
                href="/appointments?status=pending"
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl bg-gold-500 text-white hover:bg-gold-600 shadow-sm transition-all duration-200"
              >
                <Icon name="bell" className="w-4 h-4" />
                Review {stats.pending} pending
              </Link>
            )}
          </>
        }
      />

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="w-9 h-9 rounded-xl" />
              <Skeleton className="w-16 h-8 mt-4" />
              <Skeleton className="w-24 h-3 mt-2" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          <StatCard label="Today" value={stats.todayCount} icon="clock" accent hint="appointments today" delay={0} href="/calendar" />
          <StatCard label="Upcoming" value={stats.upcoming} icon="calendar" hint="from tomorrow" delay={40} href="/appointments?date=upcoming" />
          <StatCard label="Pending" value={stats.pending} icon="bell" hint="awaiting review" delay={80} href="/appointments?status=pending" />
          <StatCard label="Confirmed" value={stats.confirmed} icon="check" hint="all time" delay={120} href="/appointments?status=confirmed" />
          <StatCard label="Cancelled" value={stats.cancelled} icon="x" hint="declined + cancelled, all time" delay={160} href="/appointments" />
          {settings.revenueEnabled && (
            <StatCard
              label="Revenue"
              value={currency.format(stats.revenue.value)}
              icon="card"
              trend={stats.revenue}
              hint="this month"
              delay={200}
              href="/analytics"
            />
          )}
          <StatCard
            label="New customers"
            value={stats.newCustomers.value}
            icon="users"
            trend={stats.newCustomers}
            hint="this month"
            delay={240}
            href="/customers"
          />
          <StatCard label="Repeat customers" value={stats.repeatCustomers} icon="star" hint="booked more than once" delay={280} href="/customers" />
          <StatCard label="Occupancy" value={`${stats.occupancyRate}%`} icon="chart" hint="next 7 days" delay={320} href="/calendar" />
          <StatCard
            label="This week"
            value={stats.weekBookings.value}
            icon="trendUp"
            trend={stats.weekBookings}
            hint="vs last week"
            delay={360}
            href="/analytics"
          />
        </div>
      )}

      {/* ── Pending attention strip ────────────────────────────────────── */}
      {!loading && pendingPreview.length > 0 && (
        <Card className="mb-6 overflow-hidden animate-fade-up border-gold-200 dark:border-gold-800">
          <div className="flex items-center gap-2 px-5 py-3 bg-gold-50/60 dark:bg-gold-900/20 border-b border-gold-100 dark:border-gold-900">
            <Icon name="bell" className="w-4 h-4 text-gold-600" />
            <p className="text-sm font-bold text-ink-900 dark:text-ink-50">
              Requests waiting for you
            </p>
            <Link
              href="/appointments?status=pending"
              className="ml-auto text-xs font-semibold text-gold-600 hover:text-gold-700 transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="divide-y divide-ink-50 dark:divide-ink-800">
            {pendingPreview.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">
                    {b.Ime}
                    {b.Service && (
                      <span className="font-normal text-ink-400"> · {b.Service}</span>
                    )}
                  </p>
                  <p className="text-xs text-ink-400">
                    {b.Datum} at {b.Ura}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="success"
                    icon="check"
                    loading={acting === b.id}
                    onClick={() => quickDecide(b.id, "Confirmed")}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="x"
                    disabled={acting === b.id}
                    onClick={() => quickDecide(b.id, "Declined")}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 p-5 animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-ink-900 dark:text-ink-50">
                Booking volume
              </h2>
              <p className="text-xs text-ink-400 mt-0.5">
                Requests per day, last {range} days
              </p>
            </div>
            <Segmented
              options={[
                { value: "30", label: "30 days" },
                { value: "90", label: "90 days" },
              ]}
              value={range}
              onChange={setRange}
            />
          </div>
          {loading ? (
            <Skeleton className="w-full h-[220px]" />
          ) : (
            <AreaChart data={series} />
          )}
        </Card>

        <Card className="p-5 animate-fade-up" style={{ animationDelay: "80ms" }}>
          <h2 className="text-sm font-bold text-ink-900 dark:text-ink-50">
            Status mix
          </h2>
          <p className="text-xs text-ink-400 mt-0.5 mb-5">All appointments</p>
          {loading ? (
            <Skeleton className="w-full h-[180px]" />
          ) : (
            <DonutChart
              centerValue={String(bookings.length)}
              centerLabel="Total"
              segments={[
                { label: "Confirmed", value: stats.confirmed, color: "#10B981" },
                { label: "Pending", value: stats.pending, color: "#F59E0B" },
                { label: "Cancelled", value: stats.cancelled, color: "#F43F5E" },
              ]}
            />
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Peak hours */}
        <Card className="p-5 animate-fade-up">
          <h2 className="text-sm font-bold text-ink-900 dark:text-ink-50">
            Peak booking hours
          </h2>
          <p className="text-xs text-ink-400 mt-0.5 mb-5">All time</p>
          {loading ? (
            <Skeleton className="w-full h-[180px]" />
          ) : (
            <BarChart data={hours} height={190} />
          )}
        </Card>

        {/* Today's schedule */}
        <Card className="p-5 animate-fade-up" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-ink-900 dark:text-ink-50">
              Today&apos;s schedule
            </h2>
            <Link
              href="/calendar"
              className="text-xs font-semibold text-gold-600 hover:text-gold-700"
            >
              Open calendar →
            </Link>
          </div>
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="w-full h-12" />
              ))}
            </div>
          ) : todaysSchedule.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="Nothing scheduled today"
              description="Enjoy the quiet — or check upcoming days in the calendar."
            />
          ) : (
            <div className="flex flex-col gap-1">
              {todaysSchedule.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800/60 transition-colors"
                >
                  <span className="text-sm font-bold text-gold-600 w-12 shrink-0">
                    {b.Ura || "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">
                      {b.Ime}
                    </p>
                    {b.Service && (
                      <p className="text-xs text-ink-400 truncate">{b.Service}</p>
                    )}
                  </div>
                  <Badge tone={statusTone(b.Status)}>{statusLabel(b.Status)}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent activity */}
        <Card className="p-5 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <h2 className="text-sm font-bold text-ink-900 dark:text-ink-50 mb-4">
            Recent activity
          </h2>
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="w-full h-10" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <EmptyState
              icon="clock"
              title="No activity yet"
              description="Decisions you make on requests will show up here."
            />
          ) : (
            <div className="flex flex-col">
              {activity.map((a) => {
                const activityStatus = a.Status.trim().toLowerCase();
                const confirmed = activityStatus === "confirmed";
                return (
                  <div
                    key={`${a.id}-${a.UpdatedAt}`}
                    className="flex items-center gap-3 py-2.5 border-b border-ink-50 dark:border-ink-800/60 last:border-0"
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        confirmed
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300"
                      }`}
                    >
                      <Icon name={confirmed ? "check" : "x"} className="w-3.5 h-3.5" />
                    </span>
                    <p className="text-[13px] text-ink-600 dark:text-ink-300 min-w-0 flex-1 truncate">
                      <span className="font-semibold text-ink-900 dark:text-ink-100">
                        {a.Ime}
                      </span>{" "}
                      {confirmed ? "confirmed" : activityStatus}
                    </p>
                    <span className="text-[11px] text-ink-300 dark:text-ink-500 shrink-0">
                      {formatRelativeTime(a.UpdatedAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
