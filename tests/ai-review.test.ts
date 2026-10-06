import { describe, expect, it } from "vitest";
import type { PayloadRequest } from "payload";
import { applyReviewToken, issueReviewToken, readReviewToken, reviewFieldValues } from "@/lib/ai-review";
import type { ReviewSummary } from "@/lib/article-loop";

const review: ReviewSummary = {
  rounds: 1,
  outcome: "approved",
  score: 9,
  feedback: "",
  notes: ["First draft: 6/10 — Add a conclusion.", "Revision 1: 9/10 — approved"],
  writer: "openai/gpt-oss-20b",
  judge: "nvidia/nemotron-3-super-120b-a12b",
};
const secret = "s3cret";
const req = (userId: number) => ({ user: { id: userId }, payload: { secret } }) as unknown as PayloadRequest;

describe("review tokens", () => {
  it("round-trips for the same user and post", () => {
    const token = issueReviewToken(req(1), 7, review);
    expect(readReviewToken(token, { secret, userId: 1, postId: 7 })).toEqual(review);
  });

  it("rejects tampering, other users, other posts, expiry and other secrets", () => {
    const token = issueReviewToken(req(1), 7, review);
    const [body, sig] = token.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), review: { ...review, score: 10 } })
    ).toString("base64url");
    expect(readReviewToken(`${forgedBody}.${sig}`, { secret, userId: 1, postId: 7 })).toBeNull();
    expect(readReviewToken(token, { secret, userId: 2, postId: 7 })).toBeNull();
    expect(readReviewToken(token, { secret, userId: 1, postId: 8 })).toBeNull();
    expect(readReviewToken(token, { secret: "other", userId: 1, postId: 7 })).toBeNull();
    expect(readReviewToken(token, { secret, userId: 1, postId: 7, now: Date.now() + 7 * 3600_000 })).toBeNull();
    expect(readReviewToken("garbage", { secret, userId: 1, postId: 7 })).toBeNull();
  });

  it("a token for an unsaved post only works on the save that creates it", () => {
    const token = issueReviewToken(req(1), null, review);
    expect(readReviewToken(token, { secret, userId: 1, postId: null })).toEqual(review);
    expect(readReviewToken(token, { secret, userId: 1, postId: 3 })).toBeNull();
  });
});

describe("applyReviewToken hook", () => {
  const run = (data: Record<string, unknown>, originalDoc?: { id: number }, userId = 1) =>
    applyReviewToken({ data, originalDoc, req: req(userId) } as never) as Record<string, unknown>;

  it("copies a valid review onto the post and drops the token", () => {
    const token = issueReviewToken(req(1), 7, review);
    const out = run({ title: "x", aiReviewToken: token }, { id: 7 });
    expect(out).toMatchObject(reviewFieldValues(review));
    expect(out.aiReviewNote).toBe(review.notes.join("\n"));
    expect(out).not.toHaveProperty("aiReviewToken");
  });

  it("ignores an invalid token", () => {
    const out = run({ title: "x", aiReviewToken: "nope.nope" }, { id: 7 });
    expect(out).toEqual({ title: "x" });
  });
});
