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
  type Customer,
  type CustomerMeta,
  type Service,
  type StaffMember,
  type WorkspaceData,
} from "@/types/app";
import { deriveCustomers } from "@/lib/customers";
import { deriveNotifications } from "@/lib/notifications";

interface WorkspaceContextValue {
  loading: boolean;
  error: string | null;
  clientName: string;
  bookings: Booking[];
  services: Service[];
  staff: StaffMember[];
  settings: BusinessSettings;
  customers: Customer[];
  notifications: AppNotification[];
  unreadCount: number;
  refresh: () => Promise<void>;
  updateBooking: (
    id: string,
    fields: BookingUpdatePayload
  ) => Promise<void>;
  saveServices: (services: Service[]) => Promise<void>;
  saveStaff: (staff: StaffMember[]) => Promise<void>;
  saveSettings: (partial: Partial<BusinessSettings>) => Promise<void>;
  saveCustomerMeta: (meta: Omit<CustomerMeta, "id">) => Promise<void>;
  markAllNotificationsRead: () => void;
  isNotificationRead: (id: string) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

const READ_KEY = "notifications-read";

function loadReadSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setReadIds(loadReadSet());
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/workspace", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server responded with ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Mutations (optimistic where safe) ─────────────────────────────────────

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

  const saveServices = useCallback(async (services: Service[]) => {
    const res = await fetch("/api/services", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ services }),
    });
    if (!res.ok) throw new Error("Failed to save services.");
    setData((prev) => (prev ? { ...prev, services } : prev));
  }, []);

  const saveStaff = useCallback(async (staff: StaffMember[]) => {
    const res = await fetch("/api/staff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff }),
    });
    if (!res.ok) throw new Error("Failed to save staff.");
    setData((prev) => (prev ? { ...prev, staff } : prev));
  }, []);

  const saveSettings = useCallback(
    async (partial: Partial<BusinessSettings>) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (!res.ok) throw new Error("Failed to save settings.");
      setData((prev) =>
        prev ? { ...prev, settings: { ...prev.settings, ...partial } } : prev
      );
    },
    []
  );

  const saveCustomerMeta = useCallback(
    async (meta: Omit<CustomerMeta, "id">) => {
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
    },
    []
  );

  // ── Derived data ──────────────────────────────────────────────────────────

  const customers = useMemo(
    () => (data ? deriveCustomers(data.bookings, data.customerMeta) : []),
    [data]
  );

  const notifications = useMemo(
    () => (data ? deriveNotifications(data.bookings) : []),
    [data]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds.has(n.id)).length,
    [notifications, readIds]
  );

  const markAllNotificationsRead = useCallback(() => {
    const ids = new Set(notifications.map((n) => n.id));
    setReadIds(ids);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(Array.from(ids)));
    } catch {
      /* ignore */
    }
  }, [notifications]);

  const isNotificationRead = useCallback(
    (id: string) => readIds.has(id),
    [readIds]
  );

  const value: WorkspaceContextValue = {
    loading,
    error,
    clientName: data?.clientName ?? "",
    bookings: data?.bookings ?? [],
    services: data?.services ?? [],
    staff: data?.staff ?? [],
    settings: data?.settings ?? DEFAULT_SETTINGS,
    customers,
    notifications,
    unreadCount,
    refresh,
    updateBooking,
    saveServices,
    saveStaff,
    saveSettings,
    saveCustomerMeta,
    markAllNotificationsRead,
    isNotificationRead,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
