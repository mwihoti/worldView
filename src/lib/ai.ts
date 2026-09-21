import { APIError, type CollectionBeforeChangeHook } from "payload";
import {
  convertMarkdownToLexical,
  editorConfigFactory,
} from "@payloadcms/richtext-lexical";
import { expandBriefWithSources } from "./brief-sources";

/*
 * AI article drafting via the NVIDIA API (build.nvidia.com). The endpoint is
 * OpenAI-compatible; set NVIDIA_API_KEY (starts with "nvapi-") and optionally
 * NVIDIA_MODEL to pick a different model from the catalog.
 */
// NVIDIA_ENDPOINT can point at any OpenAI-compatible server (used by tests).
const NVIDIA_ENDPOINT =
  process.env.NVIDIA_ENDPOINT ||
  "https://integrate.api.nvidia.com/v1/chat/completions";
// NVIDIA retires models regularly (openai/gpt-oss-120b went end-of-life on
// 2026-09-03). List the current catalog at
// https://integrate.api.nvidia.com/v1/models. NVIDIA_MODEL is tried first;
// when a model answers 404/410 (retired) the next one in this list is tried.
const FALLBACK_MODELS = [
  "openai/gpt-oss-20b",
  "nvidia/nemotron-3-super-120b-a12b",
  "moonshotai/kimi-k3",
  "deepseek-ai/deepseek-v4-flash-0731",
];

function candidateModels(): string[] {
  const preferred = process.env.NVIDIA_MODEL?.trim();
  return preferred
    ? [preferred, ...FALLBACK_MODELS.filter((m) => m !== preferred)]
    : FALLBACK_MODELS;
}

function isRetiredModelStatus(status: number): boolean {
  return status === 404 || status === 410;
}

// NVIDIA's hosted endpoints occasionally return a transient gateway error
// ("Upstream request failed") when a model backend is cold or overloaded.
// Treat these the same as a retired model: try the next one in the list
// instead of failing the whole request on one flaky response.
function isTransientStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/*
 * Vercel kills the whole function at 60s on the Hobby plan (no Fluid
 * compute) regardless of what our own code does, and a hard kill produces
 * a raw "Vercel Runtime Timeout Error" instead of a JSON response the UI
 * can show. Keep enough of a margin to always finish with a clean APIError,
 * and stop trying further fallback models once there isn't time left for
 * another attempt plus the surrounding work (Lexical conversion, etc).
 */
const TOTAL_BUDGET_MS = 45_000;
const MIN_ATTEMPT_MS = 8_000;

const SYSTEM_PROMPT = `You are a staff writer for WorldView, a news blog covering world news, sports, movies & TV, and tech.

Write a complete, publishable article based on the brief you are given. Ground the article in what the brief provides; do not invent quotes, statistics, or events the brief doesn't support — for topics that depend on very recent events, write from the brief alone and stay general where it is silent.

Format your response exactly like this:
- First line: the article title as a level-1 markdown heading (# Title)
- Then the article body in markdown, using ## subheadings, short paragraphs, and lists where they help.
- No preamble, no commentary about the writing process — output only the article.`;

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

async function requestCompletion(
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  timeoutMs: number
): Promise<Response> {
  return fetch(NVIDIA_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

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

/*
 * One chat completion against the NVIDIA API, trying the configured model
 * first and falling back through FALLBACK_MODELS when a model has been
 * retired (404/410). Returns the assistant text with any <think> block
 * stripped. Throws an APIError with a user-readable message otherwise.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  { maxTokens = 4096 }: { maxTokens?: number } = {}
): Promise<string> {
  if (!process.env.NVIDIA_API_KEY) {
    throw new APIError(
      "AI is not configured: set NVIDIA_API_KEY on the server.",
      400
    );
  }

  const started = Date.now();
  const attempts: string[] = [];
  let response: Response | undefined;

  for (const model of candidateModels()) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    if (remaining < MIN_ATTEMPT_MS) {
      // Not enough of our own budget left for another round trip — stop
      // here instead of starting an attempt that would likely run into
      // Vercel's hard function limit and produce a raw, unhandled timeout.
      break;
    }

    try {
      response = await requestCompletion(model, messages, maxTokens, remaining);
    } catch (error) {
      // Network error or our own abort firing (slow/unreachable backend).
      const reason = error instanceof Error ? error.message : String(error);
      attempts.push(`${model} (network error: ${reason})`);
      response = undefined;
      continue;
    }

    if (response.ok) break;
    if (isRetiredModelStatus(response.status) || isTransientStatus(response.status)) {
      attempts.push(`${model} (${response.status}: ${await errorDetail(response)})`);
      continue;
    }
    // Any other error (bad request, auth, etc.) is not fixed by trying a
    // different model — stop and surface it.
    break;
  }

  if (!response || !response.ok) {
    if (attempts.length > 0 && !response) {
      throw new APIError(
        `The AI request failed: none of the configured models responded in time. ` +
          `Tried ${attempts.join("; ")}.`,
        504
      );
    }
    if (response && (isRetiredModelStatus(response.status) || isTransientStatus(response.status))) {
      throw new APIError(
        `The AI request failed: none of the configured models are available right now. ` +
          `Tried ${attempts.join("; ")}. If this persists, set NVIDIA_MODEL to a current ` +
          `one from https://integrate.api.nvidia.com/v1/models.`,
        502
      );
    }
    const status = response?.status ?? 502;
    const detail = response ? await errorDetail(response) : "no response";
    throw new APIError(
      `The AI request failed (${status}): ${detail}`,
      status === 401 ? 400 : 502
    );
  }

  const data = (await response.json()) as ChatCompletionResponse;
  // Reasoning models may wrap deliberation in <think> tags — keep only the
  // final text.
  return (data.choices?.[0]?.message?.content ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

export async function draftArticleMarkdown(
  prompt: string,
  existingTitle?: string
): Promise<{ title: string | null; markdown: string }> {
  const rawBrief = existingTitle
    ? `Working title: ${existingTitle}\n\nBrief: ${prompt}`
    : `Brief: ${prompt}`;
  // Pull in the text of any pages the brief links to; the model can't browse.
  const brief = await expandBriefWithSources(rawBrief);

  const text = await chatCompletion([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: brief },
  ]);

  if (!text) {
    throw new APIError("The AI returned an empty draft. Try again.", 502);
  }
  return splitTitle(text);
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

/*
 * Posts beforeChange hook: when "Draft with AI" is ticked, generate the
 * article from the AI prompt and store it as Lexical rich text.
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
