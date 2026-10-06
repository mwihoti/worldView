import {
  chatCompletionWithModel,
  describeModel,
  judgeCandidates,
  reservedJudge,
  splitTitle,
  type ChatMessage,
  type ModelRef,
} from "./ai";
import { expandBriefWithSources, extractUrls } from "./brief-sources";

/*
 * Self-review loop ("loop engineering"): after a draft exists — from initial
 * generation or from a chat-assistant revision — a separate judge pass scores
 * it, and if it's not ready the model gets one more chance to fix it, in the
 * same conversation, using the judge's own words as instructions. This
 * repeats until the judge is satisfied, a safety cap on rounds is hit, or the
 * shared time budget for the whole exchange runs low — whichever comes
 * first. Lives in its own module, separate from ai.ts's chatCompletion
 * primitive, because this file's draftArticleMarkdown() calls chatCompletion
 * and then feeds its own output back through refineArticle(); ai.ts itself
 * has no reason to depend on this file, so keeping the direction one-way
 * avoids a circular import.
 *
 * Deliberately adaptive rather than a fixed number of passes: a clean draft
 * should publish after one judge pass; a rough one gets more attention,
 * without every request paying for the maximum every time. The ceiling
 * still has to fit inside Vercel's 60s function limit (see maxDuration on
 * the Payload API route) with room to spare for everything around it
 * (Lexical conversion, the database write, JSON parsing), so one shared
 * budget covers the initial generation *and* the whole refine loop —
 * otherwise each separately defaulting to a full ~40s budget could add up
 * to well over a minute combined.
 *
 * The judge is a fixed model that never wrote the draft it grades (see
 * judgeCandidates in ai.ts), and every exit from the loop is recorded as an
 * outcome — "approved" is only ever reported when the judge really said so.
 * A judge that can't be reached still lets the draft through (an outage
 * shouldn't block writing), but is reported as such, not as an approval.
 */

export const TOTAL_REQUEST_BUDGET_MS = 50_000;
// Caps the very first generation call so it can't spend the entire request
// budget by itself, guaranteeing the loop gets a real turn even in the
// worst case (a slow model still leaves ~26s for at least one judge pass).
export const INITIAL_DRAFT_BUDGET_MS = 24_000;

// A round costs a judge call plus, usually, a revise call — reserve enough
// for both before starting one, or stop with whatever draft exists.
const MIN_ROUND_BUDGET_MS = 16_000;
const JUDGE_BUDGET_MS = 12_000;
export const MAX_ROUNDS = 3;
const READY_SCORE = 8;

const JUDGE_SYSTEM_PROMPT = `You are a strict but fair editor reviewing a draft news article for WorldView before publication.

Score it 1-10 on: factual grounding (nothing invented beyond what the brief/conversation supports), clarity, structure (subheadings and paragraphing used well), and whether it reads as a finished piece rather than a rough draft.

Reply with ONLY a single JSON object and nothing else, in exactly this shape:
{"score": <integer 1-10>, "ready": <true or false>, "feedback": "<one or two sentences on the single most important thing to fix, or empty if ready>"}`;

export type Verdict =
  | { status: "ok"; ready: boolean; score: number | null; feedback: string }
  | { status: "unreadable"; raw: string };

/* Models sometimes wrap JSON in prose or a code fence; take the first
 * {...} block found. Anything that isn't a usable verdict is reported as
 * "unreadable" rather than guessed at — the loop treats that like a judge
 * outage, never like an approval. */
export function parseVerdict(raw: string): Verdict {
  const unreadable = { status: "unreadable" as const, raw: raw.slice(0, 200) };
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return unreadable;
  let parsed: { score?: unknown; ready?: unknown; feedback?: unknown };
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return unreadable;
  }
  if (!parsed || typeof parsed !== "object") return unreadable;

  const rawScore =
    typeof parsed.score === "string" ? Number(parsed.score) : parsed.score;
  const score =
    typeof rawScore === "number" && Number.isFinite(rawScore)
      ? Math.min(10, Math.max(1, Math.round(rawScore)))
      : null;
  if (score === null && typeof parsed.ready !== "boolean") return unreadable;

  const ready = parsed.ready === true || (score !== null && score >= READY_SCORE);
  return {
    status: "ok",
    ready,
    score,
    feedback: typeof parsed.feedback === "string" ? parsed.feedback.trim() : "",
  };
}

/*
 * How the loop ended:
 *  - approved: the judge scored the final draft as ready
 *  - max-rounds: still not approved after MAX_ROUNDS revisions (the last
 *    revision is kept, but nobody judged it)
 *  - out-of-time: the shared budget ran low before the judge could approve
 *  - judge-unavailable: no independent judge answered usably, so the draft
 *    was not reviewed
 *  - revise-failed: the judge asked for changes but the revision call failed;
 *    the previous draft is kept
 */
export type ReviewOutcome =
  | "approved"
  | "max-rounds"
  | "out-of-time"
  | "judge-unavailable"
  | "revise-failed";

export type ReviewSummary = {
  /* How many revise passes ran beyond the draft handed in. */
  rounds: number;
  outcome: ReviewOutcome;
  /* The judge's most recent score and note (null/empty if it never gave a
   * usable verdict). */
  score: number | null;
  feedback: string;
  /* Every verdict in order, one line each ("First draft: 6/10 — …"), so
   * the reason for each revision survives the final approval. */
  notes: string[];
  /* Why the judge was unavailable, for the judge-unavailable outcome. */
  detail?: string;
  writer: string | null;
  judge: string | null;
};

export const OUTCOME_LABELS: Record<ReviewOutcome, string> = {
  approved: "Approved by the reviewer",
  "max-rounds": `Not approved after ${MAX_ROUNDS} revisions; last revision kept unreviewed`,
  "out-of-time": "Stopped: ran out of time before the reviewer approved",
  "judge-unavailable": "Not reviewed: the reviewer model was unavailable",
  "revise-failed": "Reviewer asked for changes but the revision failed; previous draft kept",
};

/* Progress events, in the order they happen, for the admin UI. */
export type LoopProgress =
  | { stage: "sources" }
  | { stage: "drafting" }
  | { stage: "reviewing"; round: number }
  | { stage: "revising"; round: number; score: number | null; feedback: string }
  | { stage: "done"; review: ReviewSummary };

export type ProgressFn = (event: LoopProgress) => void;

type JudgeResult =
  | { status: "ok"; verdict: Extract<Verdict, { status: "ok" }>; judge: ModelRef }
  | { status: "unavailable"; detail: string };

async function judge(
  articleMarkdown: string,
  writer: ModelRef | null,
  budgetMs: number
): Promise<JudgeResult> {
  const candidates = judgeCandidates(writer);
  if (candidates.length === 0) {
    return { status: "unavailable", detail: "no model other than the writer is configured" };
  }
  try {
    const { text, ref } = await chatCompletionWithModel(
      [
        { role: "system", content: JUDGE_SYSTEM_PROMPT },
        { role: "user", content: articleMarkdown },
      ],
      { maxTokens: 300, budgetMs, candidates }
    );
    const verdict = parseVerdict(text);
    if (verdict.status !== "ok") {
      return { status: "unavailable", detail: `${describeModel(ref)} gave an unreadable verdict` };
    }
    return { status: "ok", verdict, judge: ref };
  } catch (error) {
    // The judge failing (e.g. every judge model down) shouldn't fail the
    // whole request — keep what was already drafted, and say it's unreviewed.
    const reason = error instanceof Error ? error.message : String(error);
    return { status: "unavailable", detail: reason.slice(0, 300) };
  }
}

export type RefineResult = { markdown: string; review: ReviewSummary };

/*
 * `history` is the exact message list that produced `draftMarkdown` (not
 * including that reply yet). The loop appends the draft as the model's own
 * assistant turn — its real prior output, not a placeholder — before asking
 * for a revision, the same lesson that fixed multi-turn chat corrections:
 * without it the model has no memory of what it already wrote and tends to
 * just discuss the article instead of rewriting it.
 *
 * `budgetMs` is what's left of the shared per-request ceiling by the time
 * this is called; pass the true remainder, not a fresh full budget.
 * `writer` is the model that produced `draftMarkdown`, so the judge can be
 * kept different from it.
 */
export async function refineArticle(
  history: ChatMessage[],
  draftMarkdown: string,
  {
    maxTokens = 4096,
    budgetMs = TOTAL_REQUEST_BUDGET_MS - INITIAL_DRAFT_BUDGET_MS,
    writer = null,
    onProgress,
  }: {
    maxTokens?: number;
    budgetMs?: number;
    writer?: ModelRef | null;
    onProgress?: ProgressFn;
  } = {}
): Promise<RefineResult> {
  const started = Date.now();
  const transcript: ChatMessage[] = [
    ...history,
    { role: "assistant", content: draftMarkdown },
  ];
  const reserved = reservedJudge();
  let current = draftMarkdown;
  let currentWriter = writer;
  let rounds = 0;
  let score: number | null = null;
  let feedback = "";
  const notes: string[] = [];
  let judgeName: string | null = null;
  let outcome: ReviewOutcome = "max-rounds";
  let detail: string | undefined;

  for (;;) {
    const remaining = budgetMs - (Date.now() - started);
    if (remaining < MIN_ROUND_BUDGET_MS) {
      outcome = "out-of-time";
      break;
    }

    onProgress?.({ stage: "reviewing", round: rounds + 1 });
    const result = await judge(current, currentWriter, Math.min(JUDGE_BUDGET_MS, remaining));
    if (result.status === "unavailable") {
      outcome = "judge-unavailable";
      detail = result.detail;
      break;
    }
    judgeName = describeModel(result.judge);
    score = result.verdict.score;
    feedback = result.verdict.feedback;
    notes.push(
      `${rounds === 0 ? "First draft" : `Revision ${rounds}`}: ` +
        `${score !== null ? `${score}/10` : "no score"} — ` +
        (result.verdict.ready ? "approved" : feedback || "not ready")
    );
    if (result.verdict.ready) {
      outcome = "approved";
      break;
    }
    if (rounds >= MAX_ROUNDS) {
      outcome = "max-rounds";
      break;
    }

    const remainingForRevise = budgetMs - (Date.now() - started);
    if (remainingForRevise < MIN_ROUND_BUDGET_MS - JUDGE_BUDGET_MS) {
      outcome = "out-of-time";
      break;
    }

    onProgress?.({ stage: "revising", round: rounds + 1, score, feedback });
    transcript.push({
      role: "user",
      content:
        `An editor reviewed this and said: ${feedback || "it needs another pass before publishing."} ` +
        "Revise the article to address that. Reply with ONLY the complete revised article " +
        "(not just the changed part), starting with a level-1 heading, in the same format as before.",
    });

    let revised: { text: string; ref: ModelRef };
    try {
      revised = await chatCompletionWithModel(transcript, {
        maxTokens,
        budgetMs: remainingForRevise,
        exclude: reserved ? [reserved] : [],
      });
    } catch {
      // Keep the best draft on hand rather than failing the whole request
      // over a revision pass that didn't come back.
      outcome = "revise-failed";
      break;
    }

    current = revised.text.trim();
    currentWriter = revised.ref;
    transcript.push({ role: "assistant", content: current });
    rounds++;
  }

  return {
    markdown: current,
    review: {
      rounds,
      outcome,
      score,
      feedback,
      notes,
      ...(detail ? { detail } : {}),
      writer: currentWriter ? describeModel(currentWriter) : null,
      judge: judgeName,
    },
  };
}

const SYSTEM_PROMPT = `You are a staff writer for WorldView, a news blog covering world news, sports, movies & TV, and tech.

Write a complete, publishable article based on the brief you are given. Ground the article in what the brief provides; do not invent quotes, statistics, or events the brief doesn't support — for topics that depend on very recent events, write from the brief alone and stay general where it is silent.

Format your response exactly like this:
- First line: the article title as a level-1 markdown heading (# Title)
- Then the article body in markdown, using ## subheadings, short paragraphs, and lists where they help.
- No preamble, no commentary about the writing process — output only the article.`;

export async function draftArticleMarkdown(
  prompt: string,
  existingTitle?: string,
  { onProgress }: { onProgress?: ProgressFn } = {}
): Promise<{ title: string | null; markdown: string; review: ReviewSummary }> {
  const started = Date.now();
  const rawBrief = existingTitle
    ? `Working title: ${existingTitle}\n\nBrief: ${prompt}`
    : `Brief: ${prompt}`;
  // Pull in the text of any pages the brief links to; the model can't browse.
  if (extractUrls(rawBrief).length > 0) onProgress?.({ stage: "sources" });
  const brief = await expandBriefWithSources(rawBrief);

  const history: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: brief },
  ];
  onProgress?.({ stage: "drafting" });
  const reserved = reservedJudge();
  const draft = await chatCompletionWithModel(history, {
    budgetMs: INITIAL_DRAFT_BUDGET_MS - (Date.now() - started),
    exclude: reserved ? [reserved] : [],
  });

  const remaining = TOTAL_REQUEST_BUDGET_MS - (Date.now() - started);
  const { markdown: refined, review } = await refineArticle(history, draft.text, {
    budgetMs: remaining,
    writer: draft.ref,
    onProgress,
  });
  onProgress?.({ stage: "done", review });
  return { ...splitTitle(refined), review };
}
