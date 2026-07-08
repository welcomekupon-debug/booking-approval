"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Icon, type IconName } from "@/components/ui/icons";
import { formatRelativeTime } from "@/lib/relativeTime";
import type { NotificationKind } from "@/types/app";

const KIND_META: Record<
  NotificationKind,
  { icon: IconName; classes: string }
> = {
  request: { icon: "bell", classes: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300" },
  confirmation: { icon: "check", classes: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300" },
  cancellation: { icon: "x", classes: "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300" },
  reminder: { icon: "clock", classes: "bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300" },
  missed: { icon: "clock", classes: "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300" },
  system: { icon: "sparkle", classes: "bg-gold-50 text-gold-600 dark:bg-gold-900/30 dark:text-gold-300" },
};

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    markAllNotificationsRead,
    isNotificationRead,
  } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-xl text-ink-500 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
        aria-label="Notifications"
      >
        <Icon name="bell" className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gold-500 text-white text-[10px] font-bold flex items-center justify-center animate-scale-in">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[90vw] bg-white dark:bg-ink-900 border border-ink-100 dark:border-ink-800 rounded-2xl shadow-pop z-50 animate-scale-in origin-top-right overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100 dark:border-ink-800">
            <h3 className="text-sm font-bold text-ink-900 dark:text-ink-50">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="text-xs font-semibold text-gold-600 hover:text-gold-700 transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Icon name="bell" className="w-6 h-6 text-ink-300 mx-auto mb-2" />
                <p className="text-sm text-ink-400">You&apos;re all caught up.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const meta = KIND_META[n.kind];
                const read = isNotificationRead(n.id);
                return (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-800/60 transition-colors border-b border-ink-50 dark:border-ink-800/60 last:border-0"
                  >
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${meta.classes}`}
                    >
                      <Icon name={meta.icon} className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={`text-[13px] truncate ${
                            read
                              ? "font-medium text-ink-500 dark:text-ink-400"
                              : "font-bold text-ink-900 dark:text-ink-50"
                          }`}
                        >
                          {n.title}
                        </span>
                        {!read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
                        )}
                      </span>
                      <span className="block text-xs text-ink-400 mt-0.5 line-clamp-2">
                        {n.body}
                      </span>
                      {n.time && (
                        <span className="block text-[10px] text-ink-300 dark:text-ink-500 mt-1">
                          {formatRelativeTime(n.time.toISOString())}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
