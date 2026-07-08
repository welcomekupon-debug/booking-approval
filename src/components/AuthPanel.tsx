import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icons";

/** Split-screen premium frame around Clerk's auth widgets. */
export function AuthPanel({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand side */}
      <div className="hidden lg:flex flex-col justify-between bg-ink-950 p-12 relative overflow-hidden">
        {/* Subtle gold glow */}
        <div
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, #B99A55 0%, transparent 70%)",
          }}
        />
        <div className="flex items-center gap-3 relative">
          <span className="w-10 h-10 rounded-xl bg-gold-500 flex items-center justify-center">
            <Icon name="sparkle" className="w-5 h-5 text-white" />
          </span>
          <span>
            <span className="block text-white font-bold leading-tight">
              Bookline
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-gold-400">
              Appointments
            </span>
          </span>
        </div>

        <div className="relative">
          <h1 className="text-4xl font-bold text-white leading-tight max-w-md">
            Run your bookings like a{" "}
            <span className="text-gold-400">premium business.</span>
          </h1>
          <p className="text-ink-300 mt-4 max-w-sm leading-relaxed">
            Approve requests, manage your calendar, and know your customers —
            all in one elegant workspace.
          </p>

          <div className="flex flex-col gap-3 mt-10">
            {[
              "Instant approve & decline",
              "Google-Calendar-style scheduling",
              "Customer profiles & analytics",
            ].map((f) => (
              <span key={f} className="flex items-center gap-3 text-sm text-ink-200">
                <span className="w-5 h-5 rounded-full bg-gold-500/20 flex items-center justify-center shrink-0">
                  <Icon name="check" className="w-3 h-3 text-gold-400" />
                </span>
                {f}
              </span>
            ))}
          </div>
        </div>

        <p className="text-xs text-ink-500 relative">
          © {new Date().getFullYear()} Bookline. All rights reserved.
        </p>
      </div>

      {/* Auth side */}
      <div className="flex items-center justify-center p-6 bg-[rgb(var(--bg))]">
        {children}
      </div>
    </div>
  );
}
