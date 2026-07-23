"use client";

import {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
  useRef,
} from "react";
import { Icon, type IconName } from "./icons";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ── Card ────────────────────────────────────────────────────────────────────

export function Card({
  className,
  hover = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cx(
        "bg-white dark:bg-ink-900 border border-ink-100 dark:border-ink-800 rounded-2xl shadow-card",
        hover &&
          "transition-all duration-300 ease-spring hover:shadow-card-hover hover:-translate-y-0.5",
        className
      )}
      {...props}
    />
  );
}

// ── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "gold" | "ghost" | "danger" | "success";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-ink-900 text-white hover:bg-ink-800 dark:bg-ink-50 dark:text-ink-900 dark:hover:bg-white",
  secondary:
    "bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800",
  gold: "bg-gold-500 text-white hover:bg-gold-600 shadow-sm",
  ghost:
    "text-ink-500 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-800 dark:hover:text-ink-100",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  loading?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 whitespace-nowrap",
        size === "sm" && "text-xs px-2.5 py-1.5",
        size === "md" && "text-sm px-3.5 py-2",
        size === "lg" && "text-sm px-5 py-2.5",
        BUTTON_STYLES[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon && <Icon name={icon} className="w-4 h-4 -ml-0.5" />
      )}
      {children}
    </button>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────

export type BadgeTone = "gold" | "green" | "amber" | "red" | "grey" | "blue";

const BADGE_STYLES: Record<BadgeTone, string> = {
  gold: "bg-gold-50 text-gold-700 border-gold-200 dark:bg-gold-900/30 dark:text-gold-300 dark:border-gold-800",
  green:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  amber:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  red: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
  grey: "bg-ink-50 text-ink-600 border-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:border-ink-700",
  blue: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
};

export function Badge({
  tone = "grey",
  className,
  dot = false,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border",
        BADGE_STYLES[tone],
        className
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function statusTone(status: string): BadgeTone {
  const s = status?.trim().toLowerCase();
  if (s === "confirmed") return "green";
  if (s === "pending") return "amber";
  if (s === "declined" || s === "cancelled") return "red";
  return "grey";
}

export function statusLabel(status: string): string {
  const s = status?.trim().toLowerCase();
  if (s === "confirmed") return "Confirmed";
  if (s === "pending") return "Pending";
  if (s === "declined") return "Declined";
  if (s === "cancelled") return "Cancelled";
  return status || "Unknown";
}

// ── Inputs ──────────────────────────────────────────────────────────────────

const FIELD_BASE =
  "w-full rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3.5 py-2.5 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:border-gold-400 focus:shadow-gold-glow focus:outline-none transition-all duration-200";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(FIELD_BASE, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(FIELD_BASE, "resize-y", className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(FIELD_BASE, "appearance-none pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-ink-700 dark:text-ink-200 mb-1.5">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-xs text-ink-400 mt-1.5">{hint}</span>
      )}
    </label>
  );
}

// ── Toggle switch ───────────────────────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cx("flex items-start justify-between gap-4 py-1", disabled && "opacity-50")}>
      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">
              {label}
            </p>
          )}
          {description && (
            <p className="text-xs text-ink-400 mt-0.5">{description}</p>
          )}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cx(
          "relative shrink-0 w-10 h-6 rounded-full transition-colors duration-300",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
          checked ? "bg-gold-500" : "bg-ink-200 dark:bg-ink-700"
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-spring",
            checked && "translate-x-4"
          )}
        />
      </button>
    </div>
  );
}

// ── Avatar (initials) ───────────────────────────────────────────────────────

const AVATAR_HUES = [
  "bg-gold-100 text-gold-800 dark:bg-gold-900/40 dark:text-gold-300",
  "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
];

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];

  return (
    <span
      className={cx(
        "inline-flex items-center justify-center rounded-full font-bold shrink-0",
        size === "sm" && "w-7 h-7 text-[10px]",
        size === "md" && "w-9 h-9 text-xs",
        size === "lg" && "w-12 h-12 text-sm",
        hue,
        className
      )}
    >
      {initials}
    </span>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} />;
}

// ── Empty state ─────────────────────────────────────────────────────────────

export function EmptyState({
  icon = "sparkle",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 animate-fade-up">
      <span className="w-14 h-14 rounded-2xl bg-ink-50 dark:bg-ink-800 border border-ink-100 dark:border-ink-700 flex items-center justify-center mb-4">
        <Icon name={icon} className="w-6 h-6 text-gold-500" />
      </span>
      <h3 className="text-base font-semibold text-ink-800 dark:text-ink-100">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-ink-400 mt-1.5 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cx(
          "w-full bg-white dark:bg-ink-900 border border-ink-100 dark:border-ink-800 rounded-2xl shadow-pop animate-scale-in max-h-[90vh] overflow-y-auto",
          wide ? "max-w-2xl" : "max-w-md"
        )}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between px-6 pt-5 pb-1">
            <h2 className="text-lg font-bold text-ink-900 dark:text-ink-50">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
              aria-label="Close"
            >
              <Icon name="x" className="w-4.5 h-4.5 w-5 h-5" />
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Slide-over drawer (right side) ──────────────────────────────────────────

export function Drawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-ink-900 border-l border-ink-100 dark:border-ink-800 shadow-pop animate-slide-in-right overflow-y-auto">
        {children}
      </aside>
    </div>
  );
}

// ── Tooltip (pure CSS, hover) ───────────────────────────────────────────────

export function Tooltip({
  content,
  children,
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("relative group/tip inline-flex", className)}>
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 hidden group-hover/tip:block whitespace-nowrap rounded-lg bg-ink-900 dark:bg-ink-50 px-2.5 py-1.5 text-[11px] font-medium text-white dark:text-ink-900 shadow-pop animate-fade-in">
        {content}
      </span>
    </span>
  );
}

// ── Click-to-contact ────────────────────────────────────────────────────────
//
// Single source of truth for mailto:/tel: links so every place a customer's
// email or phone is shown behaves identically. Pass `children` for a custom
// label (icon + text, a placeholder like "Not provided", etc.) — otherwise
// the raw value is rendered. When the value is empty, renders a plain span
// (same className, non-interactive) instead of a dead link.

export function EmailLink({
  email,
  className,
  stopPropagation = false,
  children,
  ...rest
}: {
  email?: string | null;
  className?: string;
  /** Set when nested inside another clickable element (e.g. a card that opens a drawer) */
  stopPropagation?: boolean;
  children?: ReactNode;
} & Pick<HTMLAttributes<HTMLElement>, "aria-label">) {
  if (!email) {
    return children ? <span className={className}>{children}</span> : null;
  }
  return (
    <a
      href={`mailto:${email}`}
      className={className}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      {...rest}
    >
      {children ?? email}
    </a>
  );
}

export function PhoneLink({
  phone,
  className,
  stopPropagation = false,
  children,
  ...rest
}: {
  phone?: string | null;
  className?: string;
  stopPropagation?: boolean;
  children?: ReactNode;
} & Pick<HTMLAttributes<HTMLElement>, "aria-label">) {
  if (!phone) {
    return children ? <span className={className}>{children}</span> : null;
  }
  return (
    <a
      href={`tel:${phone}`}
      className={className}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      {...rest}
    >
      {children ?? phone}
    </a>
  );
}

// ── Segmented control ───────────────────────────────────────────────────────

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-ink-100 dark:bg-ink-800 border border-ink-100 dark:border-ink-700",
        className
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all duration-200 whitespace-nowrap",
            value === o.value
              ? "bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-50 shadow-sm"
              : "text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Toast (simple, imperative-free) ─────────────────────────────────────────

export function useAutoDismiss(
  value: string | null,
  clear: () => void,
  ms = 3200
) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!value) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(clear, ms);
    return () => clearTimeout(timer.current);
  }, [value, clear, ms]);
}

export function Toast({
  message,
  tone = "dark",
}: {
  message: string | null;
  tone?: "dark" | "error";
}) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-fade-up">
      <div
        className={cx(
          "px-4 py-2.5 rounded-xl shadow-pop text-sm font-medium",
          tone === "dark"
            ? "bg-ink-900 text-white dark:bg-ink-50 dark:text-ink-900"
            : "bg-rose-600 text-white"
        )}
      >
        {message}
      </div>
    </div>
  );
}

export { Icon };
export type { IconName };
