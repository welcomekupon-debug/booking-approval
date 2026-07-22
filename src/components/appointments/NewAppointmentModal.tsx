"use client";

import { useState } from "react";
import {
  useWorkspace,
  type CreateAppointmentInput,
} from "@/components/providers/WorkspaceProvider";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

export function NewAppointmentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { services, staff, settings, createAppointment } = useWorkspace();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const activeServices = services.filter((s) => s.active && s.id);

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setServiceIds([]);
    setStaffId("");
    setDate("");
    setTime("");
    setNote("");
    setError(null);
    setConflict(false);
  }

  function toggleService(id: string) {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function submit(allowConflicts = false) {
    if (!name.trim() || !date || !time) {
      setError("Name, date and time are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setConflict(false);

    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    // Interpreted as salon-local by the server? No — staff browser and salon
    // share a timezone in practice; we send the instant the picker implies.
    const startsAt = new Date(y, m - 1, d, hh, mm);

    const input: CreateAppointmentInput = {
      customer: {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      },
      serviceIds,
      staffId: staffId || null,
      startsAt,
      internalNote: note.trim() || undefined,
      allowConflicts,
    };

    try {
      await createAppointment(input);
      reset();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create appointment.";
      if (/no longer available|conflicts/i.test(message)) {
        setConflict(true);
        setError(message);
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New appointment"
      wide
    >
      <div className="flex flex-col gap-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Customer name *">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoFocus
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@email.com"
            />
          </Field>
          <Field label="Phone">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+386 …"
            />
          </Field>
        </div>

        <Field label="Services">
          {activeServices.length === 0 ? (
            <p className="text-xs text-ink-400">
              No services yet — add them in Settings → Services. The default
              duration ({settings.defaultDuration} min) will be used.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeServices.map((s) => {
                const selected = serviceIds.includes(s.id!);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id!)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                      selected
                        ? "border-gold-500 bg-gold-50 dark:bg-gold-900/20 text-gold-700 dark:text-gold-300"
                        : "border-ink-200 dark:border-ink-700 text-ink-500 hover:border-gold-300"
                    }`}
                  >
                    {selected && <Icon name="check" className="w-3 h-3" />}
                    {s.name}
                    <span className="opacity-60">{s.duration}min</span>
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Date *">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Time *">
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
          <Field label="Staff member">
            <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Anyone</option>
              {staff
                .filter((s) => s.active && s.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        <Field label="Internal note">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        {error && (
          <div className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-3.5 py-2.5">
            {error}
            {conflict && (
              <button
                onClick={() => submit(true)}
                className="block mt-1.5 font-bold text-ink-900 dark:text-ink-100 underline underline-offset-2"
              >
                Book anyway (double-booking)
              </button>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="plus"
            loading={saving}
            onClick={() => submit(false)}
          >
            Create appointment
          </Button>
        </div>
      </div>
    </Modal>
  );
}
