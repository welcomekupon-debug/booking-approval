"use client";

import { useId, useMemo, useState } from "react";
import type { SeriesPoint } from "@/lib/stats";

/**
 * Lightweight, dependency-free SVG charts with draw-in animations and
 * hover tooltips — tuned to the app's gold/ink palette.
 */

// ── Area / line chart ───────────────────────────────────────────────────────

export function AreaChart({
  data,
  height = 220,
  color = "#B99A55",
  valuePrefix = "",
  valueSuffix = "",
}: {
  data: SeriesPoint[];
  height?: number;
  color?: string;
  valuePrefix?: string;
  valueSuffix?: string;
}) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const width = 800;
  const padX = 8;
  const padTop = 16;
  const padBottom = 24;

  const { path, areaPath, points, max } = useMemo(() => {
    const max = Math.max(1, ...data.map((d) => d.value));
    const innerW = width - padX * 2;
    const innerH = height - padTop - padBottom;
    const step = data.length > 1 ? innerW / (data.length - 1) : innerW;

    const pts = data.map((d, i) => ({
      x: padX + i * step,
      y: padTop + innerH - (d.value / max) * innerH,
      ...d,
    }));

    // Smooth cubic path
    let path = "";
    pts.forEach((p, i) => {
      if (i === 0) {
        path = `M ${p.x} ${p.y}`;
      } else {
        const prev = pts[i - 1];
        const cx = (prev.x + p.x) / 2;
        path += ` C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
      }
    });

    const areaPath =
      pts.length > 0
        ? `${path} L ${pts[pts.length - 1].x} ${height - padBottom} L ${pts[0].x} ${height - padBottom} Z`
        : "";

    return { path, areaPath, points: pts, max };
  }, [data, height]);

  if (data.length === 0) return null;

  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* horizontal grid lines */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={width - padX}
            y1={padTop + (height - padTop - padBottom) * (1 - f)}
            y2={padTop + (height - padTop - padBottom) * (1 - f)}
            stroke="currentColor"
            className="text-ink-100 dark:text-ink-800"
            strokeWidth="1"
          />
        ))}

        <path d={areaPath} fill={`url(#grad-${id})`} className="chart-area" />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          className="chart-line"
          style={
            {
              strokeDasharray: 2400,
              "--path-length": 2400,
            } as React.CSSProperties
          }
        />

        {/* hover targets + markers */}
        {points.map((p, i) => (
          <g key={i}>
            <rect
              x={p.x - (width / data.length) / 2}
              y={0}
              width={width / data.length}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            {hover === i && (
              <>
                <line
                  x1={p.x}
                  x2={p.x}
                  y1={padTop}
                  y2={height - padBottom}
                  stroke={color}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.5"
                />
                <circle cx={p.x} cy={p.y} r="5" fill={color} />
                <circle cx={p.x} cy={p.y} r="9" fill={color} opacity="0.2" />
              </>
            )}
          </g>
        ))}

        {/* x labels */}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text
              key={i}
              x={p.x}
              y={height - 6}
              textAnchor="middle"
              className="fill-ink-400 dark:fill-ink-500"
              fontSize="11"
            >
              {p.label}
            </text>
          ) : null
        )}

        {/* y max label */}
        <text
          x={padX + 2}
          y={padTop - 4}
          className="fill-ink-300 dark:fill-ink-600"
          fontSize="10"
        >
          {valuePrefix}
          {max}
          {valueSuffix}
        </text>
      </svg>

      {hover !== null && points[hover] && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-ink-900 dark:bg-ink-50 text-white dark:text-ink-900 text-[11px] font-semibold px-2.5 py-1.5 shadow-pop whitespace-nowrap"
          style={{
            left: `${(points[hover].x / width) * 100}%`,
            top: `${(points[hover].y / height) * 100}%`,
            marginTop: -8,
          }}
        >
          {points[hover].label} · {valuePrefix}
          {points[hover].value}
          {valueSuffix}
        </div>
      )}
    </div>
  );
}

// ── Bar chart ───────────────────────────────────────────────────────────────

export function BarChart({
  data,
  height = 200,
  color = "#B99A55",
  valueSuffix = "",
}: {
  data: SeriesPoint[];
  height?: number;
  color?: string;
  valueSuffix?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div
      className="flex items-end gap-1.5 w-full"
      style={{ height }}
      onMouseLeave={() => setHover(null)}
    >
      {data.map((d, i) => {
        const h = Math.max(3, (d.value / max) * (height - 34));
        return (
          <div
            key={i}
            className="relative flex-1 flex flex-col items-center justify-end h-full min-w-0"
            onMouseEnter={() => setHover(i)}
          >
            {hover === i && (
              <div className="absolute -top-1 -translate-y-full z-10 rounded-lg bg-ink-900 dark:bg-ink-50 text-white dark:text-ink-900 text-[11px] font-semibold px-2 py-1 shadow-pop whitespace-nowrap">
                {d.label} · {d.value}
                {valueSuffix}
              </div>
            )}
            <div
              className="w-full rounded-t-md chart-bar transition-all duration-200"
              style={{
                height: h,
                backgroundColor: color,
                opacity: hover === null || hover === i ? 1 : 0.35,
                animationDelay: `${i * 40}ms`,
              }}
            />
            <span className="mt-1.5 text-[10px] text-ink-400 truncate w-full text-center">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Donut chart ─────────────────────────────────────────────────────────────

export function DonutChart({
  segments,
  size = 168,
  thickness = 18,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = Math.max(
    1,
    segments.reduce((s, seg) => s + seg.value, 0)
  );
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          viewBox={`0 0 ${size} ${size}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={thickness}
            className="stroke-ink-100 dark:stroke-ink-800"
          />
          {segments.map((seg, i) => {
            const len = (seg.value / total) * c;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeLinecap={seg.value > 0 ? "round" : "butt"}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                className="transition-all duration-700 ease-out"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && (
            <span className="text-2xl font-bold text-ink-900 dark:text-ink-50 stat-value">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-[11px] font-medium text-ink-400 uppercase tracking-wide">
              {centerLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 min-w-0">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2.5 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-ink-500 dark:text-ink-400 truncate">
              {seg.label}
            </span>
            <span className="ml-auto font-bold text-ink-900 dark:text-ink-100 pl-3">
              {seg.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Horizontal ranking bars ─────────────────────────────────────────────────

export function RankedBars({
  data,
  color = "#B99A55",
  valueSuffix = "",
  max: maxOverride,
}: {
  data: SeriesPoint[];
  color?: string;
  valueSuffix?: string;
  max?: number;
}) {
  const max = maxOverride ?? Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex flex-col gap-3.5">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-sm font-medium text-ink-700 dark:text-ink-200 truncate pr-3">
              {d.label}
            </span>
            <span className="text-sm font-bold text-ink-900 dark:text-ink-50 shrink-0">
              {d.value}
              {valueSuffix}
            </span>
          </div>
          <div className="h-2 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: color,
                opacity: 1 - i * 0.08,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
