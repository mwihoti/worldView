import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_ROUNDS, parseVerdict, refineArticle } from "@/lib/article-loop";
import { ARTICLE, startMockLLM, type MockCall, type MockReply } from "./helpers/mock-llm";

describe("parseVerdict", () => {
  it("reads a clean verdict", () => {
    expect(parseVerdict('{"score": 9, "ready": true, "feedback": ""}')).toEqual({
      status: "ok",
      ready: true,
      score: 9,
      feedback: "",
    });
  });

  it("finds the JSON inside prose or a code fence", () => {
    const v = parseVerdict('Here you go:\n```json\n{"score": 5, "ready": false, "feedback": "Too vague."}\n```');
    expect(v).toMatchObject({ status: "ok", ready: false, score: 5, feedback: "Too vague." });
  });

  it("counts a score of 8+ as ready even if 'ready' is missing", () => {
    expect(parseVerdict('{"score": "8"}')).toMatchObject({ status: "ok", ready: true, score: 8 });
    expect(parseVerdict('{"score": 7}')).toMatchObject({ status: "ok", ready: false });
  });

  it("clamps silly scores", () => {
    expect(parseVerdict('{"score": 42, "ready": false}')).toMatchObject({ score: 10 });
  });

  it("never turns garbage into an approval", () => {
    expect(parseVerdict("Looks great to me!").status).toBe("unreadable");
    expect(parseVerdict("{not json}").status).toBe("unreadable");
    expect(parseVerdict('{"feedback": "no score or ready"}').status).toBe("unreadable");
  });
});

describe("refineArticle", () => {
  const history = [
    { role: "system" as const, content: "You are a staff writer" },
    { role: "user" as const, content: "Brief: rain" },
  ];
  const writer = { provider: "nvidia" as const, model: "openai/gpt-oss-20b" };
  let mock: Awaited<ReturnType<typeof startMockLLM>>;
  let judgeReplies: MockReply[];

  async function setup(onWriter: (call: MockCall) => MockReply = () => ARTICLE) {
    mock = await startMockLLM((call) => (call.isJudge ? judgeReplies.shift() ?? { status: 500 } : onWriter(call)));
    vi.stubEnv("NVIDIA_API_KEY", "k");
    vi.stubEnv("NVIDIA_ENDPOINT", mock.url);
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("AI_JUDGE_MODEL", "");
    vi.stubEnv("NVIDIA_MODEL", "");
  }

  beforeEach(() => {
    judgeReplies = [];
  });
  afterEach(async () => {
    await mock?.close();
    vi.unstubAllEnvs();
  });

  it("stops after one check when the judge approves", async () => {
    await setup();
    judgeReplies = ['{"score": 9, "ready": true, "feedback": ""}'];
    const events: string[] = [];
    const { markdown, review } = await refineArticle(history, ARTICLE, {
      writer,
      budgetMs: 40_000,
      onProgress: (e) => events.push(e.stage),
    });
    expect(markdown).toBe(ARTICLE);
    expect(review).toMatchObject({ outcome: "approved", rounds: 0, score: 9 });
    expect(review.notes).toEqual(["First draft: 9/10 — approved"]);
    expect(events).toEqual(["reviewing"]);
  });

  it("revises with the judge's words and keeps every round's note", async () => {
    await setup((call) => `# Revised\n\nNow with a conclusion (${call.model}).`);
    judgeReplies = [
      '{"score": 6, "ready": false, "feedback": "Add a conclusion."}',
      '{"score": 9, "ready": true, "feedback": ""}',
    ];
    const progress: unknown[] = [];
    const { markdown, review } = await refineArticle(history, ARTICLE, {
      writer,
      budgetMs: 45_000,
      onProgress: (e) => progress.push(e),
    });
    expect(markdown).toMatch(/^# Revised/);
    expect(review).toMatchObject({ outcome: "approved", rounds: 1, score: 9, feedback: "" });
    expect(review.notes).toEqual(["First draft: 6/10 — Add a conclusion.", "Revision 1: 9/10 — approved"]);
    expect(progress).toContainEqual({ stage: "revising", round: 1, score: 6, feedback: "Add a conclusion." });

    // The revise request carried the draft as the model's own turn and the
    // judge's feedback as the instruction.
    const revise = mock.calls.find((c) => !c.isJudge)!;
    expect(revise.messages.at(-2)).toEqual({ role: "assistant", content: ARTICLE });
    expect(revise.messages.at(-1)?.content).toContain("Add a conclusion.");
  });

  it("never lets the writer judge its own work", async () => {
    await setup();
    judgeReplies = ['{"score": 9, "ready": true}'];
    const { review } = await refineArticle(history, ARTICLE, { writer, budgetMs: 40_000 });
    const judgeModels = mock.calls.filter((c) => c.isJudge).map((c) => c.model);
    expect(judgeModels).not.toContain(writer.model);
    expect(review.judge).toBe("nvidia/nemotron-3-super-120b-a12b");
    expect(review.writer).toBe(writer.model);
  });

  it("keeps the judge out of the revision race", async () => {
    await setup();
    judgeReplies = ['{"score": 3, "ready": false, "feedback": "x"}', '{"score": 9, "ready": true}'];
    await refineArticle(history, ARTICLE, { writer, budgetMs: 45_000 });
    const writers = mock.calls.filter((c) => !c.isJudge).map((c) => c.model);
    expect(writers.length).toBeGreaterThan(0);
    expect(writers).not.toContain("nvidia/nemotron-3-super-120b-a12b");
  });

  it("reports an unreadable verdict as 'reviewer unavailable', not approval", async () => {
    await setup();
    judgeReplies = ["I think it's fine."];
    const { review } = await refineArticle(history, ARTICLE, { writer, budgetMs: 40_000 });
    expect(review.outcome).toBe("judge-unavailable");
    expect(review.detail).toMatch(/unreadable verdict/);
    expect(review.score).toBeNull();
  });

  it("reports a judge outage as 'reviewer unavailable'", async () => {
    await setup();
    judgeReplies = [{ status: 500 }, { status: 500 }, { status: 500 }, { status: 500 }, { status: 500 }];
    const { markdown, review } = await refineArticle(history, ARTICLE, { writer, budgetMs: 40_000 });
    expect(markdown).toBe(ARTICLE);
    expect(review.outcome).toBe("judge-unavailable");
  });

  it(`gives up after ${MAX_ROUNDS} revisions`, async () => {
    await setup();
    judgeReplies = Array.from({ length: MAX_ROUNDS + 1 }, () => '{"score": 4, "ready": false, "feedback": "Still weak."}');
    const { review } = await refineArticle(history, ARTICLE, { writer, budgetMs: 200_000 });
    expect(review).toMatchObject({ outcome: "max-rounds", rounds: MAX_ROUNDS, score: 4 });
    expect(review.notes).toHaveLength(MAX_ROUNDS + 1);
  });

  it("stops when there isn't time for a round", async () => {
    await setup();
    const { review } = await refineArticle(history, ARTICLE, { writer, budgetMs: 5_000 });
    expect(review).toMatchObject({ outcome: "out-of-time", rounds: 0 });
    expect(mock.calls).toHaveLength(0);
  });

  it("keeps the previous draft when the revision fails", async () => {
    await setup(() => ({ status: 400 }));
    judgeReplies = ['{"score": 5, "ready": false, "feedback": "Fix it."}'];
    const { markdown, review } = await refineArticle(history, ARTICLE, { writer, budgetMs: 40_000 });
    expect(markdown).toBe(ARTICLE);
    expect(review).toMatchObject({ outcome: "revise-failed", rounds: 0, score: 5 });
  });
});
