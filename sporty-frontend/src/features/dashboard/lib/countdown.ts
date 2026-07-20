/** Coarse "2d 4h" / "3h 12m" / "8m" countdown to a future deadline. Empty once past. */
export function formatCountdown(deadlineMs: number, nowMs: number): string {
  const diff = deadlineMs - nowMs;
  if (diff <= 0) return "";
  const mins = Math.floor(diff / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rem = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${rem}m`;
  return `${Math.max(rem, 1)}m`;
}

/** Under two hours to lock = urgent. */
export const COUNTDOWN_URGENT_MS = 2 * 60 * 60 * 1000;
