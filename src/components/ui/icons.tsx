import type { SVGProps } from "react";

/**
 * Premium 1.5px-stroke line icon set (24×24 viewBox).
 * Usage: <Icon name="calendar" className="w-5 h-5" />
 */

export type IconName = keyof typeof PATHS;

const PATHS = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M8.5 10h7M8.5 13.5h7M8.5 17h4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5M15.5 5.2a3.25 3.25 0 0 1 0 5.6M17.5 14.9c1.8.7 3 2.3 3 4.6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v15.5a.5.5 0 0 0 .5.5H20" />
      <path d="M8 15v2.5M12 11v6.5M16 13v4.5M20 7l-5.5 5-3-3L8 12.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6" />
    </>
  ),
  bell: (
    <>
      <path d="M18 10a6 6 0 1 0-12 0c0 4.5-1.8 6-1.8 6h15.6S18 14.5 18 10Z" />
      <path d="M10 19.5a2.1 2.1 0 0 0 4 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.8-3.8" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  phone: (
    <path d="M6.8 3.8 8.5 3a1 1 0 0 1 1.2.4l1.6 2.7a1 1 0 0 1-.2 1.3L9.6 8.7a1 1 0 0 0-.2 1.2 11 11 0 0 0 4.7 4.7 1 1 0 0 0 1.2-.2l1.3-1.5a1 1 0 0 1 1.3-.2l2.7 1.6a1 1 0 0 1 .4 1.2l-.8 1.7a2 2 0 0 1-2.1 1.2C11.5 17.5 6.5 12.5 5.6 5.9a2 2 0 0 1 1.2-2.1Z" />
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4.5 7.5 7.5 5.5 7.5-5.5" />
    </>
  ),
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M5 6.5h14M9.5 6.5v-2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
      <path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5M10 10.5v6M14 10.5v6" />
    </>
  ),
  edit: (
    <>
      <path d="M14.5 5 19 9.5 8.5 20H4v-4.5L14.5 5Z" />
      <path d="m12.5 7 4.5 4.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M21 12h-2M5 12H3M18.4 5.6 17 7M7 17l-1.4 1.4M18.4 18.4 17 17M7 7 5.6 5.6" />
    </>
  ),
  moon: <path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5Z" />,
  star: (
    <path d="m12 4 2.4 5 5.6.7-4.1 3.8 1 5.5-4.9-2.7L7.1 19l1-5.5L4 9.7 9.6 9 12 4Z" />
  ),
  tag: (
    <>
      <path d="m13 3.5 7.5 7.5a1.5 1.5 0 0 1 0 2.1l-7.4 7.4a1.5 1.5 0 0 1-2.1 0L3.5 13V5a1.5 1.5 0 0 1 1.5-1.5h8Z" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
    </>
  ),
  download: <path d="M12 4v11m0 0 4-4m-4 4-4-4M4.5 19.5h15" />,
  logout: (
    <>
      <path d="M14 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H14" />
      <path d="m17 8.5 3.5 3.5-3.5 3.5M20 12h-9" />
    </>
  ),
  sparkle: (
    <path d="M12 3.5c.6 3.8 2.7 5.9 6.5 6.5-3.8.6-5.9 2.7-6.5 6.5-.6-3.8-2.7-5.9-6.5-6.5 3.8-.6 5.9-2.7 6.5-6.5ZM18.5 15c.3 1.9 1.3 2.9 3 3.2-1.7.3-2.7 1.3-3 3.2-.3-1.9-1.3-2.9-3-3.2 1.7-.3 2.7-1.3 3-3.2Z" />
  ),
  trendUp: <path d="m4 17 5.5-5.5 3 3L20 7m0 0h-5m5 0v5" />,
  trendDown: <path d="m4 7 5.5 5.5 3-3L20 17m0 0h-5m5 0v-5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  note: (
    <>
      <path d="M5 4.5h14a.5.5 0 0 1 .5.5v10.5L15 20H5a.5.5 0 0 1-.5-.5v-14a.5.5 0 0 1 .5-.5Z" />
      <path d="M15 20v-4.5h4.5M8 9.5h8M8 13h5" />
    </>
  ),
  building: (
    <>
      <path d="M4.5 20.5v-15a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15M14.5 9.5h4a1 1 0 0 1 1 1v10M3 20.5h18" />
      <path d="M8 8h3M8 11.5h3M8 15h3" />
    </>
  ),
  keyboard: (
    <>
      <rect x="3" y="7" width="18" height="10.5" rx="1.5" />
      <path d="M6.5 10.5h1M10 10.5h1M13.5 10.5h1M17 10.5h1M6.5 14h1M10 14h4M17 14h1" />
    </>
  ),
  shield: (
    <path d="M12 3.5 5 6v5.5c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6l-7-2.5Z" />
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 9.5h18M6.5 15h4" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="m5 18 4.5-4.5 3 3L17 12l3.5 3.5" />
    </>
  ),
  send: <path d="M20.5 3.5 3.5 10l6.5 2.5 2.5 6.5 8-15.5ZM10 12.5l4-4" />,
  refresh: (
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 3.5v4h-4" />
  ),
  dot: <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />,
  drag: (
    <path d="M9 6.5h.01M9 12h.01M9 17.5h.01M15 6.5h.01M15 12h.01M15 17.5h.01" strokeWidth={3} />
  ),
  location: (
    <>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  arrowRight: <path d="M4.5 12h15m0 0-6-6m6 6-6 6" />,
} as const;

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
