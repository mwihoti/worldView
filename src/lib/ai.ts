import Anthropic from "@anthropic-ai/sdk";
import { APIError, type CollectionBeforeChangeHook } from "payload";
import {
  convertMarkdownToLexical,
  editorConfigFactory,
} from "@payloadcms/richtext-lexical";

const SYSTEM_PROMPT = `You are a staff writer for WorldView, a news blog covering world news, sports, movies & TV, and tech.

Write a complete, publishable article based on the brief you are given. Ground the article in what the brief provides; do not invent quotes, statistics, or events the brief doesn't support — for topics that depend on very recent events, write from the brief alone and stay general where it is silent.

Format your response exactly like this:
- First line: the article title as a level-1 markdown heading (# Title)
- Then the article body in markdown, using ## subheadings, short paragraphs, and lists where they help.
- No preamble, no commentary about the writing process — output only the article.`;

export async function draftArticleMarkdown(
  prompt: string,
  existingTitle?: string
): Promise<{ title: string | null; markdown: string }> {
  const client = new Anthropic();

  const brief = existingTitle
    ? `Working title: ${existingTitle}\n\nBrief: ${prompt}`
    : `Brief: ${prompt}`;

  const stream = client.beta.messages.stream({
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: brief }],
  });

  const response = await stream.finalMessage();

  if (response.stop_reason === "refusal") {
    throw new APIError(
      "The AI declined to write this article. Try rephrasing the prompt.",
      400
    );
  }

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) {
    throw new APIError("The AI returned an empty draft. Try again.", 500);
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
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new APIError(
      "AI drafting is not configured: set ANTHROPIC_API_KEY on the server.",
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
