/* Rough reading time in whole minutes (at least 1) for an HTML string. */
export function readingMinutes(html: string, wordsPerMinute = 210): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / wordsPerMinute));
}
