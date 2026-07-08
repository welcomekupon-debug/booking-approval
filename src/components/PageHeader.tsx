import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-ink-400 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
