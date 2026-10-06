import { createHmac, timingSafeEqual } from "crypto";
import {
  APIError,
  type CollectionBeforeChangeHook,
  type Field,
  type PayloadRequest,
} from "payload";
import {
  convertMarkdownToLexical,
  editorConfigFactory,
} from "@payloadcms/richtext-lexical";
import { draftArticleMarkdown, OUTCOME_LABELS, type ReviewSummary } from "./article-loop";

/*
 * What the self-review loop concluded about a post's current AI-written
 * content, stored on the post so an editor can see why it was (or wasn't)
 * revised: rounds, how the loop ended, the judge's last score and note, and
 * which models wrote and reviewed it.
 *
 * Nobody can write these fields directly — not the admin form, not the REST
 * API — because field access denies create/update and Payload drops the
 * incoming value before any hook runs. Only server code sets them:
 *  - the "Draft with AI on save" hook, from its own loop result;
 *  - a review token: when the AI endpoints hand back a draft or revision
 *    for the editor to apply, they also return the review signed with the
 *    Payload secret. Applying the draft puts the token in a hidden field;
 *    on save, applyReviewToken checks the signature, that it was issued to
 *    this user for this post and hasn't expired, and copies the review in.
 */

const locked = { create: () => false, update: () => false };

export const aiReviewFields: Field[] = [
  {
    name: "aiReviewRounds",
    label: "AI self-review rounds",
    type: "number",
    access: locked,
    admin: {
      position: "sidebar",
      readOnly: true,
      description:
        "Set automatically whenever the AI generates or revises this post's content: how " +
        "many extra review-and-revise passes its self-check ran before settling on the " +
        "current text. Blank means no AI has written or revised the current content.",
    },
  },
  {
    name: "aiReviewStatus",
    label: "AI review result",
    type: "text",
    access: locked,
    admin: { position: "sidebar", readOnly: true },
  },
  {
    name: "aiReviewScore",
    label: "Reviewer's last score (1–10)",
    type: "number",
    access: locked,
    admin: { position: "sidebar", readOnly: true },
  },
  {
    name: "aiReviewNote",
    label: "Reviewer's notes",
    type: "textarea",
    access: locked,
    admin: { position: "sidebar", readOnly: true },
  },
  {
    name: "aiReviewModels",
    label: "AI models used",
    type: "text",
    access: locked,
    admin: { position: "sidebar", readOnly: true },
  },
  {
    // Carries a signed review from an applied AI draft to the save request.
    // Virtual: never stored.
    name: "aiReviewToken",
    type: "text",
    virtual: true,
    admin: { hidden: true },
  },
];

export function reviewStatusText(review: ReviewSummary): string {
  const label = OUTCOME_LABELS[review.outcome];
  return (review.detail ? `${label} (${review.detail})` : label).slice(0, 500);
}

export function reviewFieldValues(review: ReviewSummary) {
  const models = [
    review.writer ? `Writer: ${review.writer}` : null,
    review.judge ? `Reviewer: ${review.judge}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    aiReviewRounds: review.rounds,
    aiReviewStatus: reviewStatusText(review),
    aiReviewScore: review.score,
    aiReviewNote: review.notes.join("\n") || review.feedback || null,
    aiReviewModels: models || null,
  };
}

/* ---- review tokens ---- */

const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

type TokenBody = {
  uid: string;
  pid: string | null;
  exp: number;
  review: ReviewSummary;
};

function sign(secret: string, payload: string): string {
  return createHmac("sha256", `ai-review:${secret}`).update(payload).digest("base64url");
}

export function issueReviewToken(
  req: PayloadRequest,
  postId: string | number | null | undefined,
  review: ReviewSummary
): string {
  const body: TokenBody = {
    uid: String(req.user?.id ?? ""),
    pid: postId === null || postId === undefined ? null : String(postId),
    exp: Date.now() + TOKEN_TTL_MS,
    review,
  };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${sign(req.payload.secret, payload)}`;
}

/* The review in a token, or null if the token is forged, expired, or was
 * issued to someone else or for a different post. */
export function readReviewToken(
  token: string,
  {
    secret,
    userId,
    postId,
    now = Date.now(),
  }: { secret: string; userId: string | number; postId: string | number | null; now?: number }
): ReviewSummary | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(secret, payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  let body: TokenBody;
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (body.exp < now || body.uid !== String(userId)) return null;
  // A token issued before the post existed (pid null) only works on the
  // save that creates it; otherwise it must name this exact post.
  const target = postId === null || postId === undefined ? null : String(postId);
  if (body.pid !== target) return null;
  return body.review;
}

export const applyReviewToken: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  req,
}) => {
  const token = data?.aiReviewToken;
  if (data) delete data.aiReviewToken;
  if (typeof token !== "string" || !token || !req.user) return data;

  const review = readReviewToken(token, {
    secret: req.payload.secret,
    userId: req.user.id,
    postId: originalDoc?.id ?? null,
  });
  if (review) Object.assign(data, reviewFieldValues(review));
  return data;
};

/*
 * Posts beforeChange hook: when "Draft with AI" is set (REST/API callers;
 * the admin uses the streaming "Generate draft" button instead), generate
 * the article from the AI prompt, self-review it, and store it as Lexical
 * rich text along with the review.
 */
export const draftWithAI: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data?.draftWithAI) return data;

  const prompt = typeof data.aiPrompt === "string" ? data.aiPrompt.trim() : "";
  if (!prompt) {
    throw new APIError(
      "Fill in “AI prompt” before ticking “Draft with AI on save”.",
      400
    );
  }
  const existingTitle =
    typeof data.title === "string" && data.title.trim() ? data.title.trim() : undefined;

  const { title, markdown, review } = await draftArticleMarkdown(prompt, existingTitle);

  const editorConfig = await editorConfigFactory.default({ config: req.payload.config });
  data.content = convertMarkdownToLexical({ editorConfig, markdown });
  Object.assign(data, reviewFieldValues(review));

  if (!existingTitle && title) {
    data.title = title;
  }
  data.draftWithAI = false;

  return data;
};
