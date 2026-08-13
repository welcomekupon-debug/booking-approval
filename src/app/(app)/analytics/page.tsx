"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { PageHeader } from "@/components/PageHeader";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import { AreaChart, BarChart, RankedBars } from "@/components/ui/charts";
import {
  bookingsByHour,
  bookingsByService,
  bookingsByStaff,
  bookingsPerMonth,
  businessHourRange,
  computeDashboardStats,
  retentionRate,
  revenuePerMonth,
} from "@/lib/stats";
import { downloadCsv } from "@/lib/csv";

function KpiTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-5 animate-fade-up">
      <p className="text-[11px] font-bold uppercase tracking-widest text-ink-400">
        {label}
      </p>
      <p className="text-3xl font-bold text-ink-900 dark:text-ink-50 mt-2 stat-value tracking-tight">
        {value}
      </p>
      {sub && <p className="text-xs text-ink-400 mt-1">{sub}</p>}
    </Card>
  );
}

export default function AnalyticsPage() {
  const { bookings, settings, loading, error, refresh } = useWorkspace();

  const stats = useMemo(() => computeDashboardStats(bookings), [bookings]);
  const monthly = useMemo(() => bookingsPerMonth(bookings, 12), [bookings]);
  const revenue = useMemo(() => revenuePerMonth(bookings, 12), [bookings]);
  const services = useMemo(
    () => bookingsByService(bookings).slice(0, 6),
    [bookings]
  );
  const staffPerf = useMemo(
    () => bookingsByStaff(bookings).slice(0, 6),
    [bookings]
  );
  const hours = useMemo(
    () => bookingsByHour(bookings, businessHourRange(settings.hours)),
    [bookings, settings.hours]
  );
  const retention = useMemo(() => retentionRate(bookings), [bookings]);

  const growth = useMemo(() => {
    if (monthly.length < 2) return null;
    const cur = monthly[monthly.length - 1].value;
    const prev = monthly[monthly.length - 2].value;
    if (prev === 0) return null;
    return Math.round(((cur - prev) / prev) * 100);
  }, [monthly]);

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

  function exportReport() {
    downloadCsv(
      `bookings-report-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Name",
        "Email",
        "Phone",
        "Date",
        "Time",
        "Status",
        "Service",
        "Staff",
        "Duration",
        "Price",
        "Notes",
        "Booking ID",
      ],
      bookings.map((b) => [
        b.Ime,
        b.Gmail,
        b.Phone,
        b.Datum,
        b.Ura,
        b.Status,
        b.Service,
        b.Staff,
        b.Duration,
        b.Price,
        b.Notes,
        b.Bookingid,
      ])
    );
  }

  function exportMonthly() {
    downloadCsv(
      `monthly-summary-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Month", "Bookings", `Revenue (${settings.currency || "EUR"})`],
      monthly.map((m, i) => [m.label, m.value, revenue[i]?.value ?? 0])
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="x"
        title="Couldn't load analytics"
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
        title="Analytics"
        subtitle="How your business is performing over time."
        actions={
          <>
            <Button variant="secondary" icon="download" onClick={exportMonthly}>
              Monthly summary
            </Button>
            <Button variant="primary" icon="download" onClick={exportReport}>
              Export all data
            </Button>
          </>
        }
      />

      {/* KPI row */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="w-20 h-3" />
              <Skeleton className="w-16 h-8 mt-3" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiTile
            label="Monthly growth"
            value={growth === null ? "—" : `${growth >= 0 ? "+" : ""}${growth}%`}
            sub="bookings vs previous month"
          />
          <KpiTile
            label="Customer retention"
            value={`${retention}%`}
            sub="customers who book again"
          />
          <KpiTile
            label="Confirmation rate"
            value={
              // "Accepted" spans confirmed/completed/no-show — all three started
              // as a decision to accept the request; only decline/cancel means
              // the request was turned down. Completed appointments must count
              // here too, since confirmed ones auto-complete once they're over.
              stats.confirmed + stats.completed + stats.noShow + stats.cancelled > 0
                ? `${Math.round(
                    ((stats.confirmed + stats.completed + stats.noShow) /
                      (stats.confirmed + stats.completed + stats.noShow + stats.cancelled)) *
                      100
                  )}%`
                : "—"
            }
            sub="of decided requests"
          />
          <KpiTile
            label={settings.revenueEnabled ? "Revenue this month" : "Occupancy"}
            value={
              settings.revenueEnabled
                ? currency.format(stats.revenue.value)
                : `${stats.occupancyRate}%`
            }
            sub={settings.revenueEnabled ? "confirmed & completed" : "next 7 days"}
          />
        </div>
      )}

      {/* Trends */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5 animate-fade-up">
          <h2 className="text-sm font-bold text-ink-900 dark:text-ink-50">
            Appointment trends
          </h2>
          <p className="text-xs text-ink-400 mt-0.5 mb-4">
            Bookings per month, last 12 months
          </p>
          {loading ? (
            <Skeleton className="w-full h-[220px]" />
          ) : (
            <AreaChart data={monthly} />
          )}
        </Card>

        <Card className="p-5 animate-fade-up" style={{ animationDelay: "60ms" }}>
          <h2 className="text-sm font-bold text-ink-900 dark:text-ink-50">
            Revenue
          </h2>
          <p className="text-xs text-ink-400 mt-0.5 mb-4">
            {settings.revenueEnabled
              ? "Confirmed revenue per month"
              : "Enable revenue in Settings → Booking preferences"}
          </p>
          {loading ? (
            <Skeleton className="w-full h-[220px]" />
          ) : settings.revenueEnabled ? (
            <AreaChart data={revenue} color="#10B981" valuePrefix="" />
          ) : (
            <EmptyState
              icon="card"
              title="Revenue tracking is off"
              description="Turn it on in Settings to see revenue charts based on appointment prices."
            />
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 animate-fade-up">
          <h2 className="text-sm font-bold text-ink-900 dark:text-ink-50">
            Most popular services
          </h2>
          <p className="text-xs text-ink-400 mt-0.5 mb-5">By booking count</p>
          {loading ? (
            <Skeleton className="w-full h-[200px]" />
          ) : services.length === 0 ? (
            <EmptyState
              icon="tag"
              title="No service data yet"
              description="Bookings with a service attached will show up here."
            />
          ) : (
            <RankedBars data={services} />
          )}
        </Card>

        <Card className="p-5 animate-fade-up" style={{ animationDelay: "60ms" }}>
          <h2 className="text-sm font-bold text-ink-900 dark:text-ink-50">
            Peak booking hours
          </h2>
          <p className="text-xs text-ink-400 mt-0.5 mb-5">All time</p>
          {loading ? (
            <Skeleton className="w-full h-[200px]" />
          ) : (
            <BarChart data={hours} height={200} />
          )}
        </Card>

        <Card className="p-5 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <h2 className="text-sm font-bold text-ink-900 dark:text-ink-50">
            Staff performance
          </h2>
          <p className="text-xs text-ink-400 mt-0.5 mb-5">
            Appointments handled
          </p>
          {loading ? (
            <Skeleton className="w-full h-[200px]" />
          ) : staffPerf.length === 0 ||
            (staffPerf.length === 1 && staffPerf[0].label === "Unassigned") ? (
            <EmptyState
              icon="users"
              title="No staff data yet"
              description="Assign staff members to appointments to compare workloads."
            />
          ) : (
            <RankedBars data={staffPerf} color="#0EA5E9" />
          )}
        </Card>
      </div>

      <p className="flex items-center gap-2 text-xs text-ink-300 dark:text-ink-600 mt-6">
        <Icon name="download" className="w-3.5 h-3.5" />
        Exports download as CSV — open them in Excel or Google Sheets.
      </p>
    </div>
  );
}
