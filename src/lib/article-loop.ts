import { APIError, type CollectionBeforeChangeHook } from "payload";
import {
  convertMarkdownToLexical,
  editorConfigFactory,
} from "@payloadcms/richtext-lexical";
import { chatCompletion, splitTitle, type ChatMessage } from "./ai";
import { expandBriefWithSources } from "./brief-sources";

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
const MAX_ROUNDS = 3;
const READY_SCORE = 8;

const JUDGE_SYSTEM_PROMPT = `You are a strict but fair editor reviewing a draft news article for WorldView before publication.

Score it 1-10 on: factual grounding (nothing invented beyond what the brief/conversation supports), clarity, structure (subheadings and paragraphing used well), and whether it reads as a finished piece rather than a rough draft.

Reply with ONLY a single JSON object and nothing else, in exactly this shape:
{"score": <integer 1-10>, "ready": <true or false>, "feedback": "<one or two sentences on the single most important thing to fix, or empty if ready>"}`;

type Verdict = { ready: boolean; feedback: string };

/* Models sometimes wrap JSON in prose or a code fence; take the first
 * {...} block found. Any failure to get a clean verdict is treated as
 * "ready" — a broken judge should not be able to loop the request forever
 * or spend the rest of the time budget on retries. */
function parseVerdict(raw: string): Verdict {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { ready: true, feedback: "" };
  try {
    const parsed = JSON.parse(match[0]) as {
      score?: unknown;
      ready?: unknown;
      feedback?: unknown;
    };
    const score = typeof parsed.score === "number" ? parsed.score : undefined;
    const ready = parsed.ready === true || (score !== undefined && score >= READY_SCORE);
    return {
      ready,
      feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
    };
  } catch {
    return { ready: true, feedback: "" };
  }
}

async function judge(articleMarkdown: string, budgetMs: number): Promise<Verdict> {
  try {
    const raw = await chatCompletion(
      [
        { role: "system", content: JUDGE_SYSTEM_PROMPT },
        { role: "user", content: articleMarkdown },
      ],
      { maxTokens: 300, budgetMs }
    );
    return parseVerdict(raw);
  } catch {
    // The judge itself failing (e.g. every model down) shouldn't fail the
    // whole request — publish what was already drafted instead.
    return { ready: true, feedback: "" };
  }
}

export type RefineResult = {
  markdown: string;
  /* How many extra revise passes ran beyond the draft handed in. 0 means the
   * judge approved it immediately, or there wasn't enough budget to try. */
  rounds: number;
};

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
 */
export async function refineArticle(
  history: ChatMessage[],
  draftMarkdown: string,
  {
    maxTokens = 4096,
    budgetMs = TOTAL_REQUEST_BUDGET_MS - INITIAL_DRAFT_BUDGET_MS,
  }: { maxTokens?: number; budgetMs?: number } = {}
): Promise<RefineResult> {
  const started = Date.now();
  const transcript: ChatMessage[] = [
    ...history,
    { role: "assistant", content: draftMarkdown },
  ];
  let current = draftMarkdown;
  let rounds = 0;

  for (; rounds < MAX_ROUNDS; rounds++) {
    const remaining = budgetMs - (Date.now() - started);
    if (remaining < MIN_ROUND_BUDGET_MS) break;

    const verdict = await judge(current, Math.min(JUDGE_BUDGET_MS, remaining));
    if (verdict.ready) break;

    const remainingForRevise = budgetMs - (Date.now() - started);
    if (remainingForRevise < MIN_ROUND_BUDGET_MS - JUDGE_BUDGET_MS) break;

    transcript.push({
      role: "user",
      content:
        `An editor reviewed this and said: ${verdict.feedback || "it needs another pass before publishing."} ` +
        "Revise the article to address that. Reply with ONLY the complete revised article " +
        "(not just the changed part), starting with a level-1 heading, in the same format as before.",
    });

    let revised: string;
    try {
      revised = await chatCompletion(transcript, {
        maxTokens,
        budgetMs: remainingForRevise,
      });
    } catch {
      // Keep the best draft on hand rather than failing the whole request
      // over a revision pass that didn't come back.
      break;
    }
    if (!revised.trim()) break;

    current = revised.trim();
    transcript.push({ role: "assistant", content: current });
  }

  return { markdown: current, rounds };
}

const SYSTEM_PROMPT = `You are a staff writer for WorldView, a news blog covering world news, sports, movies & TV, and tech.

Write a complete, publishable article based on the brief you are given. Ground the article in what the brief provides; do not invent quotes, statistics, or events the brief doesn't support — for topics that depend on very recent events, write from the brief alone and stay general where it is silent.

Format your response exactly like this:
- First line: the article title as a level-1 markdown heading (# Title)
- Then the article body in markdown, using ## subheadings, short paragraphs, and lists where they help.
- No preamble, no commentary about the writing process — output only the article.`;

export async function draftArticleMarkdown(
  prompt: string,
  existingTitle?: string
): Promise<{ title: string | null; markdown: string; rounds: number }> {
  const started = Date.now();
  const rawBrief = existingTitle
    ? `Working title: ${existingTitle}\n\nBrief: ${prompt}`
    : `Brief: ${prompt}`;
  // Pull in the text of any pages the brief links to; the model can't browse.
  const brief = await expandBriefWithSources(rawBrief);

  const history: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: brief },
  ];
  const text = await chatCompletion(history, { budgetMs: INITIAL_DRAFT_BUDGET_MS });
  if (!text) {
    throw new APIError("The AI returned an empty draft. Try again.", 502);
  }

  const remaining = TOTAL_REQUEST_BUDGET_MS - (Date.now() - started);
  const { markdown: refined, rounds } = await refineArticle(history, text, {
    budgetMs: remaining,
  });
  return { ...splitTitle(refined), rounds };
}

/*
 * Posts beforeChange hook: when "Draft with AI" is ticked, generate the
 * article from the AI prompt, self-review it, and store it as Lexical rich
 * text.
 */
export const draftWithAI: CollectionBeforeChangeHook = async ({
  data,
  req,
}) => {
  if (!data?.draftWithAI) return data;

  const prompt =
    typeof data.aiPrompt === "string" ? data.aiPrompt.trim() : "";
  if (!prompt) {
    throw new APIError(
      "Fill in “AI prompt” before ticking “Draft with AI on save”.",
      400
    );
  }
  const existingTitle =
    typeof data.title === "string" && data.title.trim()
      ? data.title.trim()
      : undefined;

  const { title, markdown } = await draftArticleMarkdown(prompt, existingTitle);

  const editorConfig = await editorConfigFactory.default({
    config: req.payload.config,
  });
  data.content = convertMarkdownToLexical({ editorConfig, markdown });

  if (!existingTitle && title) {
    data.title = title;
  }
  data.draftWithAI = false;

  return data;
};
