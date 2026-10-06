/*
 * Editors often write briefs like "create article about https://example.com".
 * The model cannot browse, so fetch each linked page and hand its readable
 * text to the model alongside the brief. Best effort: unreachable or
 * non-HTML pages are reported in the brief instead of failing the save.
 */

import { lookup as dnsLookup, type LookupAddress } from "dns";
import { BlockList, isIP, type LookupFunction } from "net";
import { Agent, fetch as undiciFetch } from "undici";

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

/*
 * Fetching arbitrary URLs from the server is a classic way to reach things
 * only the server can see (cloud metadata at 169.254.169.254, databases on
 * the private network, localhost services). Every connection this module
 * makes — including each redirect hop — goes through a DNS lookup that
 * rejects private, loopback, link-local and other non-public addresses, so
 * a hostname that resolves (or re-resolves) to one of them can't be used
 * either. Responses are capped in size and must be text.
 */
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  if (family === 6) {
    const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    return !blocked.check(address, "ipv6");
  }
  return false;
}

const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const list = addresses as LookupAddress[];
    const bad = list.find((a) => !isPublicAddress(a.address));
    if (bad || list.length === 0) {
      return callback(
        Object.assign(new Error(`${hostname} is not a public address`), { code: "EBLOCKED" }),
        "",
        0
      );
    }
    if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

let agent: Agent | null = null;
function guardedAgent(): Agent {
  agent ??= new Agent({ connect: { lookup: publicOnlyLookup } });
  return agent;
}

/* Rejects anything but http(s) to a public host before connecting. IP
 * literals skip DNS, so they're checked here; hostnames are checked by the
 * lookup above at connect time. */
export function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("only http and https links can be read");
  }
  if (url.username || url.password) throw new Error("links with credentials are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) throw new Error("not a public address");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error("not a public address");
  }
  return url;
}

async function readCapped(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function fetchPageText(rawUrl: string): Promise<string> {
  let url = assertFetchableUrl(rawUrl);
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);

  for (let hop = 0; ; hop++) {
    let response;
    try {
      response = await undiciFetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; WorldViewBot/1.0)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
        },
        redirect: "manual",
        signal,
        dispatcher: guardedAgent(),
      });
    } catch (error) {
      const cause = (error as { cause?: { code?: string; message?: string } }).cause;
      if (cause?.code === "EBLOCKED") throw new Error("not a public address");
      throw error;
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error(`HTTP ${response.status} without a location`);
      if (hop >= MAX_REDIRECTS) throw new Error("too many redirects");
      url = assertFetchableUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !/text\/|application\/xhtml/.test(contentType)) {
      await response.body?.cancel();
      throw new Error(`not a web page (${contentType.split(";")[0]})`);
    }
    const body = await readCapped(response.body as ReadableStream<Uint8Array> | null);
    const text = contentType.includes("html") ? htmlToText(body) : body.trim();
    if (!text) {
      throw new Error("page had no readable text");
    }
    return text.length > MAX_CHARS_PER_PAGE
      ? `${text.slice(0, MAX_CHARS_PER_PAGE)}\n[truncated]`
      : text;
  }
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
