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
const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
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

async function requestCompletion(
  model: string,
  brief: string
): Promise<Response> {
  return fetch(NVIDIA_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: brief },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(120_000),
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

export async function draftArticleMarkdown(
  prompt: string,
  existingTitle?: string
): Promise<{ title: string | null; markdown: string }> {
  const rawBrief = existingTitle
    ? `Working title: ${existingTitle}\n\nBrief: ${prompt}`
    : `Brief: ${prompt}`;
  // Pull in the text of any pages the brief links to; the model can't browse.
  const brief = await expandBriefWithSources(rawBrief);

  const models = candidateModels();
  const retired: string[] = [];
  let response: Response | undefined;

  for (const model of models) {
    response = await requestCompletion(model, brief);
    if (response.ok || !isRetiredModelStatus(response.status)) break;
    retired.push(`${model} (${response.status}: ${await errorDetail(response)})`);
  }

  if (!response || !response.ok) {
    if (response && isRetiredModelStatus(response.status)) {
      throw new APIError(
        `The AI request failed: none of the configured models are available. ` +
          `Tried ${retired.join("; ")}. Set NVIDIA_MODEL to a current one from ` +
          `https://integrate.api.nvidia.com/v1/models.`,
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
  // final article text.
  const text = (data.choices?.[0]?.message?.content ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();

  if (!text) {
    throw new APIError("The AI returned an empty draft. Try again.", 502);
  }

  // First markdown heading becomes the title; the rest is the body.
  const match = text.match(/^#\s+(.+)\n+([\s\S]*)$/);
  if (match) {
    return { title: match[1].trim(), markdown: match[2].trim() };
  }
  return { title: null, markdown: text };
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
  if (!process.env.NVIDIA_API_KEY) {
    throw new APIError(
      "AI drafting is not configured: set NVIDIA_API_KEY on the server.",
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
