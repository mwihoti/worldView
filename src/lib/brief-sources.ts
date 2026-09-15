/*
 * Editors often write briefs like "create article about https://example.com".
 * The model cannot browse, so fetch each linked page and hand its readable
 * text to the model alongside the brief. Best effort: unreachable or
 * non-HTML pages are reported in the brief instead of failing the save.
 */

const MAX_URLS = 3;
const MAX_CHARS_PER_PAGE = 8_000;
const FETCH_TIMEOUT_MS = 10_000;

export function extractUrls(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];
  const unique = Array.from(new Set(found.map((u) => u.replace(/[.,;:!?]+$/, ""))));
  return unique.slice(0, MAX_URLS);
}

export function htmlToText(html: string): string {
  const withoutBlocks = html.replace(
    /<(script|style|noscript|svg|template)[^>]*>[\s\S]*?<\/\1>/gi,
    " "
  );
  const withBreaks = withoutBlocks.replace(
    /<\/?(p|div|br|li|h[1-6]|tr|section|article|header|footer|blockquote)[^>]*>/gi,
    "\n"
  );
  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  const decoded = stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  return decoded
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export async function fetchPageText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; WorldViewBot/1.0)",
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  const text = contentType.includes("html") ? htmlToText(body) : body.trim();
  if (!text) {
    throw new Error("page had no readable text");
  }
  return text.length > MAX_CHARS_PER_PAGE
    ? `${text.slice(0, MAX_CHARS_PER_PAGE)}\n[truncated]`
    : text;
}

/*
 * Returns the brief with a "Source pages" section appended for every URL it
 * mentions, or the brief unchanged when it contains no URLs.
 */
export async function expandBriefWithSources(brief: string): Promise<string> {
  const urls = extractUrls(brief);
  if (urls.length === 0) return brief;

  const sections = await Promise.all(
    urls.map(async (url) => {
      try {
        const text = await fetchPageText(url);
        return `### ${url}\n${text}`;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return `### ${url}\n[Could not fetch this page: ${reason}. Do not guess its contents.]`;
      }
    })
  );

  return `${brief}\n\nSource pages (fetched content, use as the factual basis for the article):\n\n${sections.join("\n\n")}`;
}
