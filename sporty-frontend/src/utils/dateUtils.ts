export function formatDate(
  date: Date | string | number,
  locale = "en-US",
): string {
  const parsedDate = parseTimestamp(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsedDate);
}

export function formatDateTime(
  date: Date | string | number,
  locale = "en-US",
): string {
  const parsedDate = parseTimestamp(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
}

export function isPastDate(date: Date | string | number): boolean {
  const parsedDate = parseTimestamp(date);
  return (
    !Number.isNaN(parsedDate.getTime()) && parsedDate.getTime() < Date.now()
  );
}

function parseTimestamp(date: Date | string | number): Date {
  if (typeof date === "string") {
    // Treat naive server timestamps as UTC to avoid local-time skew.
    const hasTimezoneInfo = /([zZ]|[+-]\d{2}:\d{2})$/.test(date);
    return new Date(hasTimezoneInfo ? date : `${date}Z`);
  }

  return new Date(date);
}

export function formatRelativeTime(
  date: Date | string | number,
  nowMs: number = Date.now(),
): string {
  const parsedDate = parseTimestamp(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Unknown time";
  }

  // Normalize to absolute UTC epoch values to avoid timezone drift issues.
  const diffMs = nowMs - parsedDate.getTime();
  const safeDiffMs = diffMs < 0 ? 0 : diffMs;

  const diffMinutes = Math.floor(safeDiffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return formatDate(parsedDate);
}
