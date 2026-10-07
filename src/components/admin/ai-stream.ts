/*
 * Client side of the streaming AI endpoints (src/lib/ai-assistant.ts): posts
 * a request, reports each progress line as it arrives, and resolves with the
 * final result line. Shared by the "Generate draft" button and the AI
 * assistant panel.
 */

import type { LoopProgress, ReviewSummary } from "@/lib/article-loop";
import type { ArticleMeta } from "@/lib/article-meta";
import type { SourceStatus } from "@/lib/brief-sources";

export type Progress = Exclude<LoopProgress, { stage: "done" }>;

export type AIReview = ReviewSummary & { status: string };

export type AIArticle = {
  title: string | null;
  markdown: string;
  lexical: unknown;
  review: AIReview;
  token: string;
  /* Only from "Generate draft": suggested summary, search description, section. */
  meta?: ArticleMeta | null;
  /* Only from "Generate draft": what happened to each link in the prompt. */
  sources?: SourceStatus[];
};

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/* "Read 2 of 3 linked pages · couldn't read example.com (HTTP 403)" */
export function sourcesText(sources: SourceStatus[]): string {
  const read = sources.filter((s) => s.ok).length;
  const failed = sources.filter((s): s is Extract<SourceStatus, { ok: false }> => !s.ok);
  const head =
    read === sources.length
      ? `Read ${read === 1 ? "the linked page" : `all ${read} linked pages`}`
      : `Read ${read} of ${sources.length} linked pages`;
  return failed.length
    ? `${head} · couldn't read ${failed.map((f) => `${host(f.url)} (${f.reason})`).join(", ")}`
    : head;
}

export async function postAIStream<T>(
  url: string,
  body: unknown,
  onProgress: (event: Progress) => void
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("ndjson") || !res.body) {
    const data = (await res.json().catch(() => ({}))) as {
      errors?: { message: string }[];
    };
    throw new Error(data.errors?.[0]?.message ?? `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffered += decoder.decode(value, { stream: !done });
    let newline: number;
    while ((newline = buffered.indexOf("\n")) >= 0) {
      const line = buffered.slice(0, newline).trim();
      buffered = buffered.slice(newline + 1);
      if (!line) continue;
      const event = JSON.parse(line) as
        | ({ type: "progress" } & Progress)
        | ({ type: "result" } & T)
        | { type: "error"; message: string };
      if (event.type === "progress") {
        onProgress(event);
      } else if (event.type === "error") {
        throw new Error(event.message);
      } else {
        return event;
      }
    }
    if (done) break;
  }
  throw new Error("The connection closed before the AI finished. Try again.");
}

export function progressText(event: Progress): string {
  switch (event.stage) {
    case "sources":
      return "Reading the pages linked in your prompt…";
    case "sources-read":
      return sourcesText(event.sources);
    case "drafting":
      return "Writing…";
    case "reviewing":
      return event.round === 1
        ? "Reviewer is checking the draft…"
        : `Reviewer is checking revision ${event.round - 1}…`;
    case "revising": {
      const score = event.score !== null ? ` (${event.score}/10)` : "";
      const note = event.feedback ? `: “${event.feedback}”` : "";
      return `Reviewer asked for changes${score}${note} — revising, round ${event.round}…`;
    }
  }
}

export function reviewText(review: AIReview): string {
  const parts = [review.status];
  if (review.score !== null) parts.push(`last score ${review.score}/10`);
  parts.push(
    review.rounds === 1 ? "1 revision" : `${review.rounds} revisions`
  );
  return parts.join(" · ");
}

type DispatchFields = (action: {
  type: "UPDATE";
  path: string;
  value: unknown;
  initialValue?: unknown;
}) => void;

/*
 * Puts an AI article into the edit form: content, title (only when empty),
 * the review fields for display, and the signed token that makes the server
 * store that review on save — the review fields themselves are read-only on
 * the server, so the displayed values alone would be ignored.
 */
export function applyArticleToForm(
  dispatchFields: DispatchFields,
  article: AIArticle,
  currentTitle: string | undefined,
  currentSection?: string | null
): void {
  // Setting initialValue alongside value makes the Lexical field re-mount
  // with the new document; value alone would be ignored by the editor.
  dispatchFields({
    type: "UPDATE",
    path: "content",
    value: article.lexical,
    initialValue: article.lexical,
  });
  if (article.title && !currentTitle?.trim()) {
    dispatchFields({ type: "UPDATE", path: "title", value: article.title });
  }
  // A new draft replaces the content, so its summary and search description
  // replace the old ones; the section is only suggested when none is set.
  if (article.meta) {
    const { summary, metaDescription, section } = article.meta;
    if (summary) dispatchFields({ type: "UPDATE", path: "subtitle", value: summary });
    if (metaDescription) dispatchFields({ type: "UPDATE", path: "metaDescription", value: metaDescription });
    if (section && !currentSection) dispatchFields({ type: "UPDATE", path: "section", value: section });
  }
  const { review } = article;
  const models = [
    review.writer ? `Writer: ${review.writer}` : null,
    review.judge ? `Reviewer: ${review.judge}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const display: Record<string, unknown> = {
    aiReviewRounds: review.rounds,
    aiReviewStatus: review.status,
    aiReviewScore: review.score,
    aiReviewNote: review.notes.join("\n") || review.feedback || null,
    aiReviewModels: models || null,
    aiReviewToken: article.token,
  };
  for (const [path, value] of Object.entries(display)) {
    dispatchFields({ type: "UPDATE", path, value });
  }
}
