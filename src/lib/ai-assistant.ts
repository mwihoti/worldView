import { APIError, type PayloadHandler, type PayloadRequest } from "payload";
import {
  convertLexicalToMarkdown,
  convertMarkdownToLexical,
  editorConfigFactory,
} from "@payloadcms/richtext-lexical";
import type { SerializedEditorState } from "lexical";
import { z } from "zod";
import { chatCompletionWithModel, reservedJudge, splitTitle, type ChatMessage } from "./ai";
import {
  draftArticleMarkdown,
  INITIAL_DRAFT_BUDGET_MS,
  refineArticle,
  TOTAL_REQUEST_BUDGET_MS,
  type LoopProgress,
  type ReviewSummary,
} from "./article-loop";
import { assertCanEditPost } from "./access";
import { issueReviewToken, reviewStatusText } from "./ai-review";
import { acquireAISlot } from "./rate-limit";

/*
 * The admin's two AI endpoints on the Posts collection:
 *
 *  POST /api/posts/ai-draft — write a first draft from the AI prompt.
 *  POST /api/posts/ai-chat  — conversational editing of the current draft.
 *
 * Both can take most of a minute (a draft, then the self-review loop), so
 * instead of one JSON body at the end they stream newline-delimited JSON:
 * a {"type":"progress",...} line as each stage starts (fetching sources,
 * drafting, reviewing round N, revising round N with the reviewer's note),
 * then one {"type":"result",...} or {"type":"error",...} line. Problems
 * found before any work starts (not logged in, not your post, too many
 * requests, bad input) are ordinary JSON errors with a status code.
 *
 * Nothing is saved here: the panel drops the result into the editor and the
 * admin saves when satisfied. The result carries a signed review token so
 * the review shows up on the post once it is saved (see ai-review.ts).
 *
 * Chat revisions: earlier versions asked the model to wrap a revision in
 * custom "<<<ARTICLE>>> ... <<<END_ARTICLE>>>" markers. Real models (NVIDIA's
 * fallback catalog, Gemini) did not reliably reproduce that exact token
 * pair, so extraction silently failed and the "Apply to editor" button never
 * appeared. The "# Title" heading convention below is the one already used
 * successfully for initial drafting (splitTitle in ./ai.ts).
 */

const MAX_HISTORY = 12;

const SYSTEM_PROMPT = `You are the editing assistant for WorldView, a news blog covering world news, sports, movies & TV, and tech. You help the editor refine an article draft.

Rules:
- Ground every change in the current article and the editor's instructions. Do not invent quotes, statistics, or events.
- When the editor asks for a change: your entire reply must be ONLY the complete revised article (not just the changed part), formatted as markdown starting with a level-1 heading on the first line (# Title), then the body with ## subheadings, short paragraphs and lists where they help. Do not add any commentary, preamble, or explanation before or after it — output nothing but the article.
- When the editor only asks a question or wants an opinion (no change requested), answer in plain prose and do not start your reply with a "#" heading.
- Keep everything you were not asked to change exactly as it is.
- If you already proposed a revision earlier in this conversation, the editor may not have applied it to the editor yet — the "current article" shown below reflects what's saved, not necessarily your last proposal. When the editor asks for a further change, continue refining your own most recent proposal from the conversation, not the original, unless the editor says otherwise.`;

const postIdSchema = z.union([z.string().max(64), z.number()]).nullish();

const chatSchema = z.object({
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
  postId: postIdSchema,
});

const draftSchema = z.object({
  prompt: z.string().max(20_000).nullish(),
  title: z.string().max(500).nullish(),
  postId: postIdSchema,
});

export function extractArticle(text: string): { reply: string; article: string | null } {
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

async function parseBody<T>(req: PayloadRequest, schema: z.ZodType<T>): Promise<T> {
  if (!req.json) throw new APIError("Expected a JSON body.", 400);
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    throw new APIError("Invalid request: " + parsed.error.issues[0]?.message, 400);
  }
  return parsed.data;
}

export type StreamEvent =
  | ({ type: "progress" } & Exclude<LoopProgress, { stage: "done" }>)
  | { type: "result"; [key: string]: unknown }
  | { type: "error"; message: string; status: number };

/*
 * Runs `work` after the up-front checks pass, streaming its progress. The
 * per-user AI slot is held until the stream ends, whether the work
 * succeeded, failed, or the browser went away.
 */
async function streamAIWork(
  req: PayloadRequest,
  postId: string | number | null | undefined,
  work: (emit: (event: LoopProgress) => void) => Promise<Record<string, unknown>>
): Promise<Response> {
  await assertCanEditPost(req, postId);
  const slot = acquireAISlot(req.user!.id);
  if (!slot.ok) {
    return Response.json(
      { errors: [{ message: slot.message }] },
      { status: 429, headers: { "Retry-After": String(slot.retryAfterSeconds) } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: StreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          open = false; // client disconnected; finish the work quietly
        }
      };
      try {
        const result = await work((event) => {
          if (event.stage !== "done") send({ type: "progress", ...event });
        });
        send({ type: "result", ...result });
      } catch (error) {
        const status = error instanceof APIError ? error.status : 500;
        const message = error instanceof Error ? error.message : String(error);
        send({ type: "error", message, status });
      } finally {
        slot.release();
        if (open) {
          try {
            controller.close();
          } catch {
            // already closed by the client
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Ask proxies not to buffer, so progress lines arrive as they happen.
      "X-Accel-Buffering": "no",
    },
  });
}

function reviewPayload(req: PayloadRequest, postId: unknown, review: ReviewSummary) {
  return {
    review: { ...review, status: reviewStatusText(review) },
    token: issueReviewToken(req, (postId as string | number | null) ?? null, review),
  };
}

export const aiDraftHandler: PayloadHandler = async (req) => {
  if (!req.user) throw new APIError("You must be logged in to use the AI assistant.", 401);
  const { prompt, title, postId } = await parseBody(req, draftSchema);
  const brief = prompt?.trim();
  if (!brief) throw new APIError("Fill in “AI prompt” first.", 400);

  return streamAIWork(req, postId, async (emit) => {
    const existingTitle = title?.trim() || undefined;
    const draft = await draftArticleMarkdown(brief, existingTitle, { onProgress: emit });
    const editorConfig = await editorConfigFactory.default({ config: req.payload.config });
    const lexical = convertMarkdownToLexical({ editorConfig, markdown: draft.markdown });
    return {
      article: {
        title: draft.title,
        markdown: draft.markdown,
        lexical,
        ...reviewPayload(req, postId, draft.review),
      },
    };
  });
};

export const aiAssistantHandler: PayloadHandler = async (req) => {
  if (!req.user) throw new APIError("You must be logged in to use the AI assistant.", 401);
  const { messages, title, brief, content, postId } = await parseBody(req, chatSchema);

  return streamAIWork(req, postId, async (emit) => {
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

    const started = Date.now();
    emit({ stage: "drafting" });
    // Every turn regenerates the complete article, so keep this only as high
    // as a typical post needs — a lower ceiling means a faster response and
    // less risk of running into Vercel's 60s function limit. The call itself
    // is capped so the self-review loop below is guaranteed a real turn too
    // (see article-loop.ts for why one shared budget covers both).
    const reserved = reservedJudge();
    const answer = await chatCompletionWithModel(chat, {
      maxTokens: 3000,
      budgetMs: INITIAL_DRAFT_BUDGET_MS,
      exclude: reserved ? [reserved] : [],
    });

    const { reply, article } = extractArticle(answer.text);
    if (!article) {
      // A plain answer, not a proposed change — nothing to self-review.
      return { reply, article: null };
    }

    const remaining = TOTAL_REQUEST_BUDGET_MS - (Date.now() - started);
    const { markdown: refinedArticle, review } = await refineArticle(chat, article, {
      maxTokens: 3000,
      budgetMs: remaining,
      writer: answer.ref,
      onProgress: emit,
    });

    const { title: newTitle, markdown } = splitTitle(refinedArticle);
    const lexical = convertMarkdownToLexical({ editorConfig, markdown });
    return {
      reply,
      article: {
        title: newTitle,
        markdown,
        lexical,
        ...reviewPayload(req, postId, review),
      },
    };
  });
};
