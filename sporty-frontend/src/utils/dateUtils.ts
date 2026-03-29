export function formatDate(
  date: Date | string | number,
  locale = "en-US",
): string {
  const parsedDate = new Date(date);
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
  const parsedDate = new Date(date);
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
  const parsedDate = new Date(date);
  return (
    !Number.isNaN(parsedDate.getTime()) && parsedDate.getTime() < Date.now()
  );
}
