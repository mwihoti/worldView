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
 * article. We convert that back to Lexical so the panel can drop it straight
 * into the editor. Nothing is saved here: the admin reviews the result and
 * publishes when satisfied.
 *
 * Earlier version asked the model to wrap a revision in custom
 * "<<<ARTICLE>>> ... <<<END_ARTICLE>>>" markers alongside a short prose
 * summary. In production, real models (NVIDIA's fallback catalog, Gemini)
 * did not reliably reproduce that exact token pair, so extraction silently
 * failed and the "Apply to editor" button never appeared even though the
 * model had, in fact, tried to help. The "# Title" heading convention below
 * is the same one already used successfully for initial drafting
 * (draftArticleMarkdown/splitTitle in ./ai.ts) — reusing a convention models
 * already comply with reliably, instead of inventing a new fragile one.
 */

const MAX_HISTORY = 12;

const SYSTEM_PROMPT = `You are the editing assistant for WorldView, a news blog covering world news, sports, movies & TV, and tech. You help the editor refine an article draft.

Rules:
- Ground every change in the current article and the editor's instructions. Do not invent quotes, statistics, or events.
- When the editor asks for a change: your entire reply must be ONLY the complete revised article (not just the changed part), formatted as markdown starting with a level-1 heading on the first line (# Title), then the body with ## subheadings, short paragraphs and lists where they help. Do not add any commentary, preamble, or explanation before or after it — output nothing but the article.
- When the editor only asks a question or wants an opinion (no change requested), answer in plain prose and do not start your reply with a "#" heading.
- Keep everything you were not asked to change exactly as it is.
- If you already proposed a revision earlier in this conversation, the editor may not have applied it to the editor yet — the "current article" shown below reflects what's saved, not necessarily your last proposal. When the editor asks for a further change, continue refining your own most recent proposal from the conversation, not the original, unless the editor says otherwise.`;

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
  const trimmed = text.trim();
  // A level-1 heading marks the start of a complete revised article (the
  // same convention splitTitle() already parses for initial drafting).
  // Everything from that line on is the article; anything before it (rare —
  // the model is asked not to add any) is treated as a conversational
  // reply. No heading anywhere means the model didn't propose a change.
  const match = trimmed.match(/^#\s+.+$/m);
  if (!match || match.index === undefined) {
    return { reply: trimmed, article: null };
  }
  const article = trimmed.slice(match.index).trim();
  const reply = trimmed.slice(0, match.index).trim();
  return {
    reply: reply || "Here's the revised article.",
    article,
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

  // Every turn regenerates the complete article, so keep this only as high
  // as a typical post needs — a lower ceiling means a faster response and
  // less risk of running into Vercel's 60s function limit.
  const text = await chatCompletion(chat, { maxTokens: 3000 });
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
