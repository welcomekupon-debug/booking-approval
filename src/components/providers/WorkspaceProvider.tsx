"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Booking, BookingUpdatePayload } from "@/types/booking";
import {
  DEFAULT_SETTINGS,
  type AppNotification,
  type BusinessSettings,
  type ChangeRequestItem,
  type Customer,
  type CustomerMeta,
  type NotificationKind,
  type Service,
  type StaffMember,
  type WorkspaceData,
} from "@/types/app";
import { deriveCustomers } from "@/lib/customers";
import { deriveNotifications } from "@/lib/notifications";

export interface CreateAppointmentInput {
  customer: { name: string; email?: string; phone?: string };
  serviceIds: string[];
  staffId?: string | null;
  startsAt: Date;
  internalNote?: string;
  allowConflicts?: boolean;
}

interface WorkspaceContextValue {
  loading: boolean;
  error: string | null;
  clientName: string;
  salonSlug: string;
  bookings: Booking[];
  services: Service[];
  staff: StaffMember[];
  settings: BusinessSettings;
  customers: Customer[];
  notifications: AppNotification[];
  unreadCount: number;
  changeRequests: ChangeRequestItem[];
  refresh: () => Promise<void>;
  updateBooking: (id: string, fields: BookingUpdatePayload) => Promise<void>;
  createAppointment: (input: CreateAppointmentInput) => Promise<void>;
  saveServices: (services: Service[]) => Promise<void>;
  saveStaff: (staff: StaffMember[]) => Promise<void>;
  saveSettings: (partial: Partial<BusinessSettings>) => Promise<void>;
  saveCustomerMeta: (meta: CustomerMeta) => Promise<void>;
  markAllNotificationsRead: () => void;
  isNotificationRead: (id: string) => boolean;
  resolveChangeRequest: (
    id: string,
    action: "approve" | "decline"
  ) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

/** localStorage read-state for client-derived items (reminders/missed) */
const READ_KEY = "notifications-read";

function loadReadSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

const KIND_MAP: Record<string, NotificationKind> = {
  new_request: "request",
  confirmation: "confirmation",
  cancellation: "cancellation",
  reminder: "reminder",
  missed: "missed",
  system: "system",
  change_requested: "request",
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(new Set());
  const [serverReadIds, setServerReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalReadIds(loadReadSet());
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/workspace", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server responded with ${res.status}`);
      }
      const next = (await res.json()) as WorkspaceData;
      setData(next);
      setServerReadIds(
        new Set(
          next.notifications.filter((n) => n.readAt !== null).map((n) => n.id)
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const updateBooking = useCallback(
    async (id: string, fields: BookingUpdatePayload) => {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update booking.");
      }
      const { updatedAt } = await res.json();

      // Optimistic local patch; statuses map through the legacy labels
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          bookings: prev.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  Status: fields.status ?? b.Status,
                  Datum: fields.datum ?? b.Datum,
                  Ura: fields.ura ?? b.Ura,
                  Notes: fields.notes ?? b.Notes,
                  Service: fields.service ?? b.Service,
                  Staff: fields.staff ?? b.Staff,
                  Phone: fields.phone ?? b.Phone,
                  Duration: fields.duration ?? b.Duration,
                  Price: fields.price ?? b.Price,
                  UpdatedAt: updatedAt ?? new Date().toISOString(),
                }
              : b
          ),
        };
      });
    },
    []
  );

  const createAppointment = useCallback(
    async (input: CreateAppointmentInput) => {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          startsAt: input.startsAt.toISOString(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create appointment.");
      }
      await refresh();
    },
    [refresh]
  );

  const saveServices = useCallback(
    async (services: Service[]) => {
      const res = await fetch("/api/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services }),
      });
      if (!res.ok) throw new Error("Failed to save services.");
      await refresh(); // fresh copy carries the new ids
    },
    [refresh]
  );

  const saveStaff = useCallback(
    async (staff: StaffMember[]) => {
      const res = await fetch("/api/staff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff }),
      });
      if (!res.ok) throw new Error("Failed to save staff.");
      await refresh();
    },
    [refresh]
  );

  const saveSettings = useCallback(
    async (partial: Partial<BusinessSettings>) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save settings.");
      }
      setData((prev) =>
        prev ? { ...prev, settings: { ...prev.settings, ...partial } } : prev
      );
    },
    []
  );

  const saveCustomerMeta = useCallback(async (meta: CustomerMeta) => {
    const res = await fetch("/api/customers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meta),
    });
    if (!res.ok) throw new Error("Failed to save customer.");
    setData((prev) => {
      if (!prev) return prev;
      const email = meta.email.trim().toLowerCase();
      const exists = prev.customerMeta.some((c) => c.email === email);
      const entry: CustomerMeta = { ...meta, email };
      return {
        ...prev,
        customerMeta: exists
          ? prev.customerMeta.map((c) => (c.email === email ? entry : c))
          : [...prev.customerMeta, entry],
      };
    });
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────

  const customers = useMemo(
    () => (data ? deriveCustomers(data.bookings, data.customerMeta) : []),
    [data]
  );

  const notifications = useMemo<AppNotification[]>(() => {
    if (!data) return [];

    // Persistent rows from Postgres
    const server: AppNotification[] = data.notifications.map((n) => ({
      id: n.id,
      kind: KIND_MAP[n.type] ?? "system",
      title: n.title,
      body: n.body,
      time: new Date(n.createdAt),
      href:
        n.type === "new_request"
          ? "/appointments?status=pending"
          : n.type === "change_requested" && n.appointmentId
            ? `/appointments?open=${n.appointmentId}`
            : "/appointments",
    }));

    // Client-derived, time-sensitive items (today's reminders, missed)
    const derived = deriveNotifications(data.bookings).filter(
      (n) => n.kind === "reminder" || n.kind === "missed"
    );

    return [...server, ...derived]
      .sort((a, b) => (b.time?.getTime() ?? 0) - (a.time?.getTime() ?? 0))
      .slice(0, 50);
  }, [data]);

  const isNotificationRead = useCallback(
    (id: string) => serverReadIds.has(id) || localReadIds.has(id),
    [serverReadIds, localReadIds]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !isNotificationRead(n.id)).length,
    [notifications, isNotificationRead]
  );

  const markAllNotificationsRead = useCallback(() => {
    // Server rows
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "readAll" }),
    }).catch(() => undefined);
    setServerReadIds(new Set(data?.notifications.map((n) => n.id) ?? []));

    // Derived rows → localStorage
    const ids = new Set(notifications.map((n) => n.id));
    setLocalReadIds(ids);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(Array.from(ids)));
    } catch {
      /* ignore */
    }
  }, [data, notifications]);

  const resolveChangeRequest = useCallback(
    async (id: string, action: "approve" | "decline") => {
      const res = await fetch(`/api/change-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to resolve request.");
      }
      await refresh();
    },
    [refresh]
  );

  const value: WorkspaceContextValue = {
    loading,
    error,
    clientName: data?.clientName ?? "",
    salonSlug: data?.salonSlug ?? "",
    bookings: data?.bookings ?? [],
    services: data?.services ?? [],
    staff: data?.staff ?? [],
    settings: data?.settings ?? DEFAULT_SETTINGS,
    customers,
    notifications,
    unreadCount,
    changeRequests: data?.changeRequests ?? [],
    refresh,
    updateBooking,
    createAppointment,
    saveServices,
    saveStaff,
    saveSettings,
    saveCustomerMeta,
    markAllNotificationsRead,
    isNotificationRead,
    resolveChangeRequest,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
