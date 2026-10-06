/*
 * "2 hours ago" for the last week, a plain date after that: a headline that
 * says "112 weeks ago" helps nobody. Pages are regenerated every few
 * minutes, so the relative times stay close enough.
 */
const longDate = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : longDate.format(date);
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const seconds = Math.round((then - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "just now";
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86_400) return relative.format(Math.round(seconds / 86_400), "day");
  return longDate.format(new Date(then));
}
