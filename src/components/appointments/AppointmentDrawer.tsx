"use client";

import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  EmailLink,
  Field,
  Input,
  PhoneLink,
  Select,
  Textarea,
  statusLabel,
  statusTone,
} from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import { parseBookingDate, toSheetDate } from "@/lib/dates";
import { normStatus } from "@/lib/stats";
import type { Booking } from "@/types/booking";

function toInputDate(datum: string): string {
  const d = parseBookingDate(datum);
  if (!d) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function fromInputDate(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return value;
  return toSheetDate(new Date(+m[1], +m[2] - 1, +m[3]));
}

export function AppointmentDrawer({
  booking,
  onClose,
}: {
  booking: Booking | null;
  onClose: () => void;
}) {
  const {
    services,
    staff,
    settings,
    updateBooking,
    changeRequests,
    resolveChangeRequest,
  } = useWorkspace();

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [service, setService] = useState("");
  const [assignee, setAssignee] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deciding, setDeciding] = useState<"Confirmed" | "Declined" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [resolving, setResolving] = useState<"approve" | "decline" | null>(null);

  useEffect(() => {
    if (!booking) return;
    setDate(toInputDate(booking.Datum));
    setTime(booking.Ura ?? "");
    setService(booking.Service ?? "");
    setAssignee(booking.Staff ?? "");
    setDuration(booking.Duration ?? "");
    setPrice(booking.Price ?? "");
    setNotes(booking.Notes ?? "");
    setError(null);
    setSaved(false);
  }, [booking]);

  const dirty = useMemo(() => {
    if (!booking) return false;
    return (
      date !== toInputDate(booking.Datum) ||
      time !== (booking.Ura ?? "") ||
      service !== (booking.Service ?? "") ||
      assignee !== (booking.Staff ?? "") ||
      duration !== (booking.Duration ?? "") ||
      price !== (booking.Price ?? "") ||
      notes !== (booking.Notes ?? "")
    );
  }, [booking, date, time, service, assignee, duration, price, notes]);

  if (!booking) return null;

  const status = normStatus(booking);

  async function save() {
    if (!booking) return;
    setSaving(true);
    setError(null);
    try {
      await updateBooking(booking.id, {
        datum: date ? fromInputDate(date) : undefined,
        ura: time || undefined,
        service,
        staff: assignee,
        duration,
        price,
        notes,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function decide(next: "Confirmed" | "Declined") {
    if (!booking) return;
    setDeciding(next);
    setError(null);
    try {
      await updateBooking(booking.id, { status: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setDeciding(null);
    }
  }

  const pendingRequest = changeRequests.find(
    (r) => r.appointmentId === booking?.id
  );

  async function handleResolve(action: "approve" | "decline") {
    if (!pendingRequest) return;
    setResolving(action);
    setError(null);
    try {
      await resolveChangeRequest(pendingRequest.id, action);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve request.");
    } finally {
      setResolving(null);
    }
  }

  return (
    <Drawer open onClose={onClose}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={booking.Ime} size="lg" />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-ink-900 dark:text-ink-50 truncate">
                {booking.Ime}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge tone={statusTone(booking.Status)} dot>
                  {statusLabel(booking.Status)}
                </Badge>
                {booking.Bookingid && (
                  <span className="text-[11px] text-ink-300 dark:text-ink-500">
                    #{booking.Bookingid}
                  </span>
                )}
              </div>
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

        {/* Customer-requested change, awaiting review */}
        {pendingRequest && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/15 p-4 mb-6">
            <div className="flex items-center gap-2 mb-1.5">
              <Icon name="clock" className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-sm font-bold text-ink-900 dark:text-ink-50">
                {pendingRequest.type === "cancel"
                  ? "Customer requested cancellation"
                  : "Customer suggested a new time"}
              </p>
            </div>
            {pendingRequest.type === "reschedule" && pendingRequest.requestedStartsAt && (
              <p className="text-xs text-ink-600 dark:text-ink-300 mb-1.5">
                Proposed:{" "}
                {new Intl.DateTimeFormat(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(pendingRequest.requestedStartsAt))}
              </p>
            )}
            {pendingRequest.customerNote && (
              <p className="text-xs text-ink-500 dark:text-ink-400 italic mb-2">
                &ldquo;{pendingRequest.customerNote}&rdquo;
              </p>
            )}
            <div className="flex gap-2 mt-2">
              <Button
                variant="success"
                size="sm"
                icon="check"
                className="flex-1"
                loading={resolving === "approve"}
                disabled={resolving !== null}
                onClick={() => handleResolve("approve")}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon="x"
                className="flex-1"
                loading={resolving === "decline"}
                disabled={resolving !== null}
                onClick={() => handleResolve("decline")}
              >
                Decline
              </Button>
            </div>
          </div>
        )}

        {/* Contact actions */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <EmailLink
            email={booking.Gmail}
            className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-ink-200 dark:border-ink-700 hover:border-gold-300 hover:bg-gold-50/50 dark:hover:bg-gold-900/10 transition-all group"
          >
            <Icon name="mail" className="w-4 h-4 text-gold-600 shrink-0" />
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-400">
                Email
              </span>
              <span className="block text-xs font-semibold text-ink-800 dark:text-ink-100 truncate">
                {booking.Gmail || "—"}
              </span>
            </span>
          </EmailLink>
          <PhoneLink
            phone={booking.Phone}
            className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-ink-200 dark:border-ink-700 transition-all ${
              booking.Phone
                ? "hover:border-gold-300 hover:bg-gold-50/50 dark:hover:bg-gold-900/10"
                : "opacity-60 cursor-default"
            }`}
          >
            <Icon name="phone" className="w-4 h-4 text-gold-600 shrink-0" />
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-400">
                Phone
              </span>
              <span className="block text-xs font-semibold text-ink-800 dark:text-ink-100 truncate">
                {booking.Phone || "Not provided"}
              </span>
            </span>
          </PhoneLink>
        </div>

        {/* Status actions */}
        {status === "pending" && (
          <div className="flex gap-2 mb-6">
            <Button
              variant="success"
              icon="check"
              className="flex-1"
              loading={deciding === "Confirmed"}
              disabled={deciding !== null}
              onClick={() => decide("Confirmed")}
            >
              Confirm
            </Button>
            <Button
              variant="danger"
              icon="x"
              className="flex-1"
              loading={deciding === "Declined"}
              disabled={deciding !== null}
              onClick={() => decide("Declined")}
            >
              Decline
            </Button>
          </div>
        )}
        {status === "confirmed" && (
          <Button
            variant="secondary"
            icon="x"
            className="w-full mb-6"
            loading={deciding === "Declined"}
            onClick={() => decide("Declined")}
          >
            Cancel appointment
          </Button>
        )}
        {(status === "declined" || status === "cancelled") && (
          <Button
            variant="success"
            icon="check"
            className="w-full mb-6"
            loading={deciding === "Confirmed"}
            onClick={() => decide("Confirmed")}
          >
            Restore & confirm
          </Button>
        )}

        {/* Details form */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-300 dark:text-ink-600 mb-3">
          Appointment details
        </p>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Time">
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Service">
              <Select value={service} onChange={(e) => setService(e.target.value)}>
                <option value="">Not set</option>
                {services
                  .filter((s) => s.active || s.name === service)
                  .map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                {service && !services.some((s) => s.name === service) && (
                  <option value={service}>{service}</option>
                )}
              </Select>
            </Field>
            <Field label="Staff member">
              <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Unassigned</option>
                {staff
                  .filter((s) => s.active || s.name === assignee)
                  .map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                {assignee && !staff.some((s) => s.name === assignee) && (
                  <option value={assignee}>{assignee}</option>
                )}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration (min)">
              <Input
                type="number"
                min={5}
                step={5}
                value={duration}
                placeholder={String(settings.defaultDuration)}
                onChange={(e) => setDuration(e.target.value)}
              />
            </Field>
            <Field label={`Price (${settings.currency || "EUR"})`}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={price}
                placeholder="0"
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Internal notes" hint="Only you can see these.">
            <Textarea
              rows={3}
              value={notes}
              placeholder="Preferences, allergies, follow-ups…"
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <Button
            variant="primary"
            icon={saved ? "check" : "edit"}
            loading={saving}
            disabled={!dirty && !saved}
            onClick={save}
            className="w-full"
          >
            {saved ? "Saved" : "Save changes"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
