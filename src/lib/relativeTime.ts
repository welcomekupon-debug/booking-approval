/**
 * Convert an ISO timestamp string into a human-readable relative time string.
 * Returns an empty string for invalid / missing input.
 *
 * Examples:
 *   < 60s   → "Just now"
 *   < 60m   → "5 minutes ago"
 *   < 24h   → "3 hours ago"
 *   1 day   → "Yesterday"
 *   < 7d    → "4 days ago"
 *   < 30d   → "2 weeks ago"
 *   older   → "May 15"  (short month + day)
 */
export function formatRelativeTime(timestamp: string): string {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
  if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? "hour" : "hours"} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
