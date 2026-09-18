import { APIError, type PayloadHandler } from "payload";
import {
  convertLexicalToMarkdown,
  convertMarkdownToLexical,
  editorConfigFactory,
} from "@payloadcms/richtext-lexical";
import type { SerializedEditorState } from "lexical";
import { z } from "zod";
import { chatCompletion, splitTitle, type ChatMessage } from "./ai";

/*
 * Conversational editing of a draft inside the admin. The panel sends the
 * chat history plus the article as it currently is in the editor; the model
 * answers and, when asked to change something, returns the complete revised
 * article between markers. We convert that back to Lexical so the panel can
 * drop it straight into the editor. Nothing is saved here: the admin reviews
 * the result and publishes when satisfied.
 */

const ARTICLE_START = "<<<ARTICLE>>>";
const ARTICLE_END = "<<<END_ARTICLE>>>";
const MAX_HISTORY = 12;

const SYSTEM_PROMPT = `You are the editing assistant for WorldView, a news blog covering world news, sports, movies & TV, and tech. You help the editor refine an article draft.

Rules:
- Ground every change in the current article and the editor's instructions. Do not invent quotes, statistics, or events.
- When the editor asks for changes, first reply in one to three plain sentences describing what you changed, then output the COMPLETE revised article (not just the changed part) between the lines ${ARTICLE_START} and ${ARTICLE_END}. Inside the markers use markdown: a level-1 heading with the title on the first line, then the body with ## subheadings, short paragraphs and lists where they help.
- When the editor only asks a question or wants an opinion, answer it and do not output the markers.
- Keep everything you were not asked to change exactly as it is.`;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(20_000),
      })
    )
    .min(1),
  // Form fields arrive as null when empty.
  title: z.string().max(500).nullish(),
  brief: z.string().max(20_000).nullish(),
  content: z.unknown().nullish(),
});

function extractArticle(text: string): { reply: string; article: string | null } {
  const start = text.indexOf(ARTICLE_START);
  if (start === -1) return { reply: text.trim(), article: null };
  const afterStart = start + ARTICLE_START.length;
  const end = text.indexOf(ARTICLE_END, afterStart);
  const article = text.slice(afterStart, end === -1 ? undefined : end).trim();
  const reply = (
    text.slice(0, start) + (end === -1 ? "" : text.slice(end + ARTICLE_END.length))
  ).trim();
  return {
    reply: reply || "Here is the revised article.",
    article: article || null,
  };
}

function isLexicalState(value: unknown): value is SerializedEditorState {
  return (
    typeof value === "object" &&
    value !== null &&
    "root" in value &&
    typeof (value as { root?: unknown }).root === "object"
  );
}

export const aiAssistantHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    throw new APIError("You must be logged in to use the AI assistant.", 401);
  }
  if (!req.json) {
    throw new APIError("Expected a JSON body.", 400);
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new APIError("Invalid request: " + parsed.error.issues[0]?.message, 400);
  }
  const { messages, title, brief, content } = parsed.data;

  const editorConfig = await editorConfigFactory.default({
    config: req.payload.config,
  });

  let currentArticle = "";
  if (isLexicalState(content)) {
    try {
      currentArticle = convertLexicalToMarkdown({ data: content, editorConfig });
    } catch {
      currentArticle = "";
    }
  }

  const context = [
    title ? `Working title: ${title}` : null,
    brief ? `Original brief from the editor:\n${brief}` : null,
    currentArticle
      ? `Current article (markdown):\n${currentArticle}`
      : "The article is currently empty.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const chat: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: context },
    {
      role: "assistant",
      content:
        "Understood. I have the current article. Tell me what to change or ask me anything about it.",
    },
    ...messages.slice(-MAX_HISTORY),
  ];

  const text = await chatCompletion(chat, { maxTokens: 6000 });
  if (!text) {
    throw new APIError("The AI returned an empty reply. Try again.", 502);
  }

  const { reply, article } = extractArticle(text);
  if (!article) {
    return Response.json({ reply, article: null });
  }

  const { title: newTitle, markdown } = splitTitle(article);
  const lexical = convertMarkdownToLexical({ editorConfig, markdown });
  return Response.json({
    reply,
    article: { title: newTitle, markdown, lexical },
  });
};
