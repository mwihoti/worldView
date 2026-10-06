import { APIError } from "payload";

/*
 * AI article drafting and the admin chat assistant, primarily via the
 * NVIDIA API (build.nvidia.com, free). The endpoint is OpenAI-compatible;
 * set NVIDIA_API_KEY (starts with "nvapi-") and optionally NVIDIA_MODEL to
 * pick a different model from the catalog.
 *
 * Gemini (Google AI Studio, also free on the Flash tier) is a backstop: it
 * is only tried when every NVIDIA attempt fails, since NVIDIA's community
 * model catalog has proven flaky (models retired without notice, transient
 * gateway errors, individual backends slow enough to exhaust the whole
 * request budget). Set GEMINI_API_KEY to enable it; no code change needed
 * to turn it off again — just remove the key. Both are optional; at least
 * one must be set.
 *
 * Endpoints, keys and model names are read on every call rather than at
 * import, so tests can point them at a local mock server.
 */

// NVIDIA retires models regularly (openai/gpt-oss-120b went end-of-life on
// 2026-09-03). List the current catalog at
// https://integrate.api.nvidia.com/v1/models. NVIDIA_MODEL is tried first;
// when a model answers 404/410 (retired) the next one in this list is tried.
export const FALLBACK_MODELS = [
  "openai/gpt-oss-20b",
  "nvidia/nemotron-3-super-120b-a12b",
  "moonshotai/kimi-k3",
  "deepseek-ai/deepseek-v4-flash-0731",
];

/*
 * The self-review judge's preferred NVIDIA model when Gemini isn't available
 * to act as an independent reviewer (see judgeCandidates). A different
 * family from the default writer, so the writer isn't grading its own work.
 */
const DEFAULT_JUDGE_MODEL = "nvidia/nemotron-3-super-120b-a12b";

export type Provider = "nvidia" | "gemini";
export type ModelRef = { provider: Provider; model: string };

type ProviderConfig = { endpoint: string; apiKey: string | undefined };

function providerConfig(provider: Provider): ProviderConfig {
  if (provider === "nvidia") {
    return {
      // NVIDIA_ENDPOINT can point at any OpenAI-compatible server (tests).
      endpoint:
        process.env.NVIDIA_ENDPOINT ||
        "https://integrate.api.nvidia.com/v1/chat/completions",
      apiKey: process.env.NVIDIA_API_KEY,
    };
  }
  return {
    // Gemini's OpenAI-compatible endpoint (https://ai.google.dev/gemini-api/docs/openai).
    endpoint:
      process.env.GEMINI_ENDPOINT ||
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    apiKey: process.env.GEMINI_API_KEY,
  };
}

function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
}

export function nvidiaModels(): string[] {
  const preferred = process.env.NVIDIA_MODEL?.trim();
  return preferred
    ? [preferred, ...FALLBACK_MODELS.filter((m) => m !== preferred)]
    : FALLBACK_MODELS;
}

export function describeModel(ref: ModelRef): string {
  return ref.provider === "gemini" ? `Gemini ${ref.model}` : ref.model;
}

export function sameModel(a: ModelRef, b: ModelRef): boolean {
  return a.provider === b.provider && a.model === b.model;
}

/*
 * Who reviews a draft in the self-review loop. The judge must never be the
 * model that wrote the draft, or it ends up approving its own work, and it
 * should be the same model from one request to the next so its scores are
 * comparable. Order of preference:
 *   1. AI_JUDGE_MODEL, if set ("gemini" or "gemini:<model>" for Gemini,
 *      anything else is an NVIDIA model id);
 *   2. Gemini, when GEMINI_API_KEY is set — a different provider entirely;
 *   3. DEFAULT_JUDGE_MODEL on NVIDIA, then the rest of the NVIDIA list.
 * The writer's model is removed from whatever list results, so a fallback
 * can't quietly turn the writer into its own reviewer.
 */
export function judgeCandidates(writer: ModelRef | null): ModelRef[] {
  const configured = process.env.AI_JUDGE_MODEL?.trim();
  const list: ModelRef[] = [];
  if (configured) {
    if (configured === "gemini") list.push({ provider: "gemini", model: geminiModel() });
    else if (configured.startsWith("gemini:"))
      list.push({ provider: "gemini", model: configured.slice("gemini:".length) });
    else list.push({ provider: "nvidia", model: configured });
  }
  if (process.env.GEMINI_API_KEY) list.push({ provider: "gemini", model: geminiModel() });
  list.push({ provider: "nvidia", model: DEFAULT_JUDGE_MODEL });
  for (const model of nvidiaModels()) list.push({ provider: "nvidia", model });

  const unique: ModelRef[] = [];
  for (const ref of list) {
    if (writer && sameModel(ref, writer)) continue;
    if (!unique.some((u) => sameModel(u, ref))) unique.push(ref);
  }
  return unique;
}

function isConfigured(ref: ModelRef): boolean {
  return Boolean(providerConfig(ref.provider).apiKey);
}

/*
 * The judge model to keep out of the writer's race, so the same reviewer
 * grades every draft and never grades its own. Null when the judge is the
 * only configured model — excluding it would leave nothing to write with
 * (the loop then reports that no independent reviewer was available).
 */
export function reservedJudge(): ModelRef | null {
  const judge = judgeCandidates(null).find(isConfigured);
  if (!judge) return null;
  const writers: ModelRef[] = [
    ...nvidiaModels().map((model) => ({ provider: "nvidia" as const, model })),
    { provider: "gemini", model: geminiModel() },
  ];
  return writers.some((w) => isConfigured(w) && !sameModel(w, judge)) ? judge : null;
}

function isRetiredModelStatus(status: number): boolean {
  return status === 404 || status === 410;
}

// NVIDIA's hosted endpoints occasionally return a transient gateway error
// ("Upstream request failed") when a model backend is cold or overloaded.
// Treat these the same as a retired model: try the next one in the list
// instead of failing the whole request on one flaky response.
function isTransientStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/*
 * Vercel kills the whole function at 60s on the Hobby plan (no Fluid
 * compute) regardless of what our own code does, and a hard kill produces
 * a raw "Vercel Runtime Timeout Error" instead of a JSON response the UI
 * can show. Keep enough of a margin to always finish with a clean APIError,
 * and stop trying further fallback models once there isn't time left for
 * another attempt plus the surrounding work (Lexical conversion, etc).
 * Split the total budget between the NVIDIA phase and the Gemini backstop
 * so one doesn't starve the other; NVIDIA gets more since it has more
 * candidates to work through.
 */
const NVIDIA_BUDGET_MS = 30_000;
const GEMINI_TIMEOUT_MS = 12_000;
export const MIN_ATTEMPT_MS = 8_000;
// A single chatCompletion() call defaults to this much total time (NVIDIA
// racing + the Gemini backstop combined). The self-review loop in
// article-loop.ts calls chatCompletion() several times against one shared,
// shrinking deadline, so it overrides this per call with whatever time is
// actually left — same machinery, smaller slice.
const DEFAULT_TOTAL_BUDGET_MS = NVIDIA_BUDGET_MS + GEMINI_TIMEOUT_MS;
/*
 * A single slow model can eat the whole budget before a second one ever
 * gets a turn (seen in production: one attempt at 45s, nothing else
 * tried). Race this many candidates at once instead of going one at a
 * time — the fastest response wins and the rest are cancelled. Small on
 * purpose: this is an occasional admin action, not high-volume traffic,
 * and each attempt is a full completion request against the API quota.
 */
const RACE_SIZE = 2;

type ChatCompletionResponse = {
  choices?: {
    message?: { content?: string };
    finish_reason?: string;
  }[];
  error?: { message?: string };
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function errorDetail(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body) as ChatCompletionResponse & {
      detail?: string;
    };
    return parsed.error?.message ?? parsed.detail ?? body.slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}

type ModelAttemptError = Error & {
  ref: ModelRef;
  status?: number;
  // A fatal error (bad request, bad API key, ...) is not fixed by trying a
  // different model on the same provider. A retired (404/410) or transient
  // (429/502/503/504) status, or a network/timeout failure, is — those keep
  // the race going.
  fatal?: boolean;
};

function attemptError(
  ref: ModelRef,
  message: string,
  extra: { status?: number; fatal?: boolean } = {}
): ModelAttemptError {
  return Object.assign(new Error(`${describeModel(ref)} (${message})`), {
    ref,
    ...extra,
  });
}

/* Reasoning models may wrap deliberation in <think> tags — keep only the
 * final text. */
function extractText(data: ChatCompletionResponse): string {
  return (data.choices?.[0]?.message?.content ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

async function attemptModel(
  ref: ModelRef,
  messages: ChatMessage[],
  maxTokens: number,
  signal: AbortSignal
): Promise<{ ref: ModelRef; text: string }> {
  const { endpoint, apiKey } = providerConfig(ref.provider);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ref.model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
      signal,
    });
  } catch (error) {
    // Network error, or our own abort firing (slow/unreachable backend).
    const reason = error instanceof Error ? error.message : String(error);
    throw attemptError(ref, `network error: ${reason}`);
  }
  if (!response.ok) {
    const detail = await errorDetail(response);
    const retryable =
      isRetiredModelStatus(response.status) || isTransientStatus(response.status);
    throw attemptError(ref, `${response.status}: ${detail}`, {
      status: response.status,
      fatal: !retryable,
    });
  }
  // Read the body inside the attempt, so a race is only won by a model that
  // actually delivered a complete answer, not one that merely sent headers.
  let text: string;
  try {
    text = extractText((await response.json()) as ChatCompletionResponse);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw attemptError(ref, `unreadable response: ${reason}`);
  }
  if (!text) throw attemptError(ref, "empty response");
  return { ref, text };
}

/*
 * Tries `candidates` in order, `raceSize` at a time, within `budgetMs`. The
 * fastest success in a group wins and the rest of that group is cancelled;
 * when a whole group fails on retryable errors the next group gets whatever
 * budget remains. A fatal error stops every remaining candidate on that
 * provider (a bad key affects them all) but not candidates on the other.
 */
async function runCandidates(
  messages: ChatMessage[],
  candidates: ModelRef[],
  {
    budgetMs,
    maxTokens,
    raceSize,
  }: { budgetMs: number; maxTokens: number; raceSize: number },
  attempts: string[]
): Promise<{ ref: ModelRef; text: string } | null> {
  const started = Date.now();
  const deadProviders = new Set<Provider>();
  const queue = candidates.filter((c) => providerConfig(c.provider).apiKey);

  while (queue.length > 0) {
    const remaining = budgetMs - (Date.now() - started);
    if (remaining < MIN_ATTEMPT_MS) break;

    const group: ModelRef[] = [];
    while (group.length < raceSize && queue.length > 0) {
      const next = queue.shift()!;
      if (!deadProviders.has(next.provider)) group.push(next);
    }
    if (group.length === 0) break;

    const controllers = group.map(() => new AbortController());
    const timer = setTimeout(() => {
      controllers.forEach((c) => c.abort());
    }, remaining);

    try {
      const winner = await Promise.any(
        group.map((ref, idx) =>
          attemptModel(ref, messages, maxTokens, controllers[idx].signal)
        )
      );
      // The winner's body has been read already; cancel everyone else.
      controllers.forEach((c) => c.abort());
      return winner;
    } catch (error) {
      if (!(error instanceof AggregateError)) throw error;
      for (const e of error.errors as ModelAttemptError[]) {
        attempts.push(e.message);
        if (e.fatal) deadProviders.add(e.ref.provider);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export type CompletionOptions = {
  maxTokens?: number;
  budgetMs?: number;
  /* Try exactly these models, one at a time, instead of the default
   * NVIDIA race followed by the Gemini backstop. */
  candidates?: ModelRef[];
  /* Leave these models out of the default race (used to keep the
   * self-review judge from also writing the draft it will grade). */
  exclude?: ModelRef[];
};

export type Completion = { text: string; ref: ModelRef };

/*
 * One chat completion, plus which model produced it. With no explicit
 * `candidates`, the NVIDIA list is raced in groups of RACE_SIZE and Gemini
 * is a single backstop attempt (the budget split between the two the same
 * way as the defaults, so a caller asking for a smaller slice — the
 * self-review loop, later in a request — still gives the backstop a fair
 * fraction). Throws an APIError with a user-readable message when nothing
 * answers.
 */
export async function chatCompletionWithModel(
  messages: ChatMessage[],
  {
    maxTokens = 4096,
    budgetMs = DEFAULT_TOTAL_BUDGET_MS,
    candidates,
    exclude = [],
  }: CompletionOptions = {}
): Promise<Completion> {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!nvidiaKey && !geminiKey) {
    throw new APIError(
      "AI is not configured: set NVIDIA_API_KEY (https://build.nvidia.com, free) " +
        "and/or GEMINI_API_KEY (https://aistudio.google.com/apikey, free) on the server.",
      400
    );
  }

  const attempts: string[] = [];
  let result: Completion | null = null;

  if (candidates) {
    result = await runCandidates(
      messages,
      candidates,
      { budgetMs, maxTokens, raceSize: 1 },
      attempts
    );
  } else {
    const started = Date.now();
    const nvidiaBudget = geminiKey
      ? Math.round(budgetMs * (NVIDIA_BUDGET_MS / DEFAULT_TOTAL_BUDGET_MS))
      : budgetMs;
    result = await runCandidates(
      messages,
      nvidiaModels()
        .map((model) => ({ provider: "nvidia" as const, model }))
        .filter((ref) => !exclude.some((x) => sameModel(x, ref))),
      { budgetMs: nvidiaBudget, maxTokens, raceSize: RACE_SIZE },
      attempts
    );
    if (!result) {
      // Gemini backstop — only reached if NVIDIA wasn't configured or every
      // NVIDIA attempt above failed. Gets whatever the NVIDIA phase left.
      result = await runCandidates(
        messages,
        [{ provider: "gemini" as const, model: geminiModel() }].filter(
          (ref) => !exclude.some((x) => sameModel(x, ref))
        ),
        { budgetMs: budgetMs - (Date.now() - started), maxTokens, raceSize: 1 },
        attempts
      );
    }
  }

  if (result) return result;

  throw new APIError(
    `The AI request failed: none of the configured models responded. ` +
      (attempts.length ? `Tried ${attempts.join("; ")}.` : "Not enough time was left to try any.") +
      (nvidiaKey && !candidates
        ? " If NVIDIA keeps failing, set NVIDIA_MODEL to a current one from " +
          "https://integrate.api.nvidia.com/v1/models, or set GEMINI_API_KEY " +
          "for a fallback provider."
        : ""),
    504
  );
}

/* The text of a chat completion, for callers that don't care which model
 * answered. */
export async function chatCompletion(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): Promise<string> {
  return (await chatCompletionWithModel(messages, options)).text;
}

/* First markdown heading becomes the title; the rest is the body. */
export function splitTitle(markdown: string): {
  title: string | null;
  markdown: string;
} {
  const match = markdown.trim().match(/^#\s+(.+)\n+([\s\S]*)$/);
  if (match) {
    return { title: match[1].trim(), markdown: match[2].trim() };
  }
  return { title: null, markdown: markdown.trim() };
}
