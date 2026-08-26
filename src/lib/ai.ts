import { APIError, type CollectionBeforeChangeHook } from "payload";
import {
  convertMarkdownToLexical,
  editorConfigFactory,
} from "@payloadcms/richtext-lexical";

/*
 * AI article drafting via the NVIDIA API (build.nvidia.com). The endpoint is
 * OpenAI-compatible; set NVIDIA_API_KEY (starts with "nvapi-") and optionally
 * NVIDIA_MODEL to pick a different model from the catalog.
 */
const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "meta/llama-3.3-70b-instruct";

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

export async function draftArticleMarkdown(
  prompt: string,
  existingTitle?: string
): Promise<{ title: string | null; markdown: string }> {
  const brief = existingTitle
    ? `Working title: ${existingTitle}\n\nBrief: ${prompt}`
    : `Brief: ${prompt}`;

  const response = await fetch(NVIDIA_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.NVIDIA_MODEL || DEFAULT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: brief },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const body = await response.text();
    let detail = body.slice(0, 200);
    try {
      detail = (JSON.parse(body) as ChatCompletionResponse).error?.message ?? detail;
    } catch {
      /* keep raw text */
    }
    throw new APIError(
      `The AI request failed (${response.status}): ${detail}`,
      response.status === 401 ? 400 : 502
    );
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";

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
