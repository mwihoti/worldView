import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chatCompletionWithModel,
  FALLBACK_MODELS,
  judgeCandidates,
  reservedJudge,
} from "@/lib/ai";
import { startMockLLM } from "./helpers/mock-llm";

const messages = [{ role: "user" as const, content: "hi" }];

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("NVIDIA_MODEL", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("NVIDIA_API_KEY", "");
  vi.stubEnv("AI_JUDGE_MODEL", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("chatCompletionWithModel", () => {
  it("fails clearly when no provider is configured", async () => {
    await expect(chatCompletionWithModel(messages)).rejects.toThrow(/AI is not configured/);
  });

  it("skips retired models (404/410) and reports which model answered", async () => {
    const mock = await startMockLLM(({ model }) =>
      model === FALLBACK_MODELS[0] || model === FALLBACK_MODELS[1] ? { status: 404 } : `from ${model}`
    );
    vi.stubEnv("NVIDIA_API_KEY", "k");
    vi.stubEnv("NVIDIA_ENDPOINT", mock.url);
    const result = await chatCompletionWithModel(messages, { budgetMs: 20_000 });
    expect(result.ref.provider).toBe("nvidia");
    expect([FALLBACK_MODELS[2], FALLBACK_MODELS[3]]).toContain(result.ref.model);
    expect(result.text).toBe(`from ${result.ref.model}`);
    await mock.close();
  });

  it("races two models and takes the faster one", async () => {
    const mock = await startMockLLM(({ model }) =>
      model === FALLBACK_MODELS[0] ? { delayMs: 3000, reply: "slow" } : "fast"
    );
    vi.stubEnv("NVIDIA_API_KEY", "k");
    vi.stubEnv("NVIDIA_ENDPOINT", mock.url);
    const started = Date.now();
    const result = await chatCompletionWithModel(messages, { budgetMs: 20_000 });
    expect(result.text).toBe("fast");
    expect(result.ref.model).toBe(FALLBACK_MODELS[1]);
    expect(Date.now() - started).toBeLessThan(2500);
    await mock.close();
  });

  it("treats an empty answer as a failure and moves on", async () => {
    const mock = await startMockLLM(({ model }) =>
      model === FALLBACK_MODELS[0] || model === FALLBACK_MODELS[1] ? "<think>hmm</think>" : "real"
    );
    vi.stubEnv("NVIDIA_API_KEY", "k");
    vi.stubEnv("NVIDIA_ENDPOINT", mock.url);
    expect((await chatCompletionWithModel(messages, { budgetMs: 20_000 })).text).toBe("real");
    await mock.close();
  });

  it("stops NVIDIA on a fatal error (bad key) and falls back to Gemini", async () => {
    const nvidia = await startMockLLM(() => ({ status: 401 }));
    const gemini = await startMockLLM(() => "from gemini");
    vi.stubEnv("NVIDIA_API_KEY", "bad");
    vi.stubEnv("NVIDIA_ENDPOINT", nvidia.url);
    vi.stubEnv("GEMINI_API_KEY", "g");
    vi.stubEnv("GEMINI_ENDPOINT", gemini.url);
    const result = await chatCompletionWithModel(messages, { budgetMs: 40_000 });
    expect(result).toMatchObject({ text: "from gemini", ref: { provider: "gemini" } });
    // Only the first race group was tried before giving up on NVIDIA.
    expect(nvidia.calls.length).toBeLessThanOrEqual(2);
    await nvidia.close();
    await gemini.close();
  });

  it("names every attempt when nothing answers", async () => {
    const mock = await startMockLLM(() => ({ status: 503 }));
    vi.stubEnv("NVIDIA_API_KEY", "k");
    vi.stubEnv("NVIDIA_ENDPOINT", mock.url);
    await expect(chatCompletionWithModel(messages, { budgetMs: 20_000 })).rejects.toThrow(
      new RegExp(FALLBACK_MODELS[0].replace("/", "\\/"))
    );
    await mock.close();
  });

  it("leaves excluded models out of the race", async () => {
    const mock = await startMockLLM(({ model }) => `from ${model}`);
    vi.stubEnv("NVIDIA_API_KEY", "k");
    vi.stubEnv("NVIDIA_ENDPOINT", mock.url);
    await chatCompletionWithModel(messages, {
      budgetMs: 20_000,
      exclude: [{ provider: "nvidia", model: FALLBACK_MODELS[0] }],
    });
    expect(mock.calls.map((c) => c.model)).not.toContain(FALLBACK_MODELS[0]);
    await mock.close();
  });

  it("falls back to an excluded model when everything else fails", async () => {
    // Production incident 2026-10-21: the whole NVIDIA list was down while
    // Gemini sat excluded as the reserved judge, and the request failed
    // outright. The excluded model must be tried dead last instead.
    const mock = await startMockLLM(({ model }) =>
      model === "gemini-judge" ? "rescued" : { status: 404 }
    );
    vi.stubEnv("NVIDIA_API_KEY", "k");
    vi.stubEnv("NVIDIA_ENDPOINT", mock.url);
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("GEMINI_ENDPOINT", mock.url);
    vi.stubEnv("GEMINI_MODEL", "gemini-judge");
    const result = await chatCompletionWithModel(messages, {
      budgetMs: 20_000,
      exclude: [{ provider: "gemini", model: "gemini-judge" }],
    });
    expect(result.text).toBe("rescued");
    expect(result.ref).toEqual({ provider: "gemini", model: "gemini-judge" });
    // All non-excluded models were tried first; the excluded one came last.
    expect(mock.calls.at(-1)?.model).toBe("gemini-judge");
    expect(new Set(mock.calls.map((c) => c.model)).size).toBe(FALLBACK_MODELS.length + 1);
    await mock.close();
  });

  it("lets a slow-but-healthy model use the whole remaining budget", async () => {
    // Articles take these models 20-35s to generate, so a race group must
    // never be cut off early to save time for the models queued behind it —
    // a cap that reserved time for them aborted healthy models
    // mid-generation and broke drafting in production (2026-10-21).
    const mock = await startMockLLM(({ model }) =>
      model === FALLBACK_MODELS[0]
        ? { delayMs: 11_000, reply: "slow but complete article" }
        : { delayMs: 60_000, reply: "never" }
    );
    vi.stubEnv("NVIDIA_API_KEY", "k");
    vi.stubEnv("NVIDIA_ENDPOINT", mock.url);
    const result = await chatCompletionWithModel(messages, { budgetMs: 13_000 });
    expect(result.text).toBe("slow but complete article");
    await mock.close();
  }, 20_000);

  it("tries explicit candidates one at a time, in order", async () => {
    const mock = await startMockLLM(({ model }) => (model === "a/one" ? { status: 404 } : `from ${model}`));
    vi.stubEnv("NVIDIA_API_KEY", "k");
    vi.stubEnv("NVIDIA_ENDPOINT", mock.url);
    const result = await chatCompletionWithModel(messages, {
      budgetMs: 20_000,
      candidates: [
        { provider: "nvidia", model: "a/one" },
        { provider: "nvidia", model: "b/two" },
        { provider: "nvidia", model: "c/three" },
      ],
    });
    expect(result.ref.model).toBe("b/two");
    expect(mock.calls.map((c) => c.model)).toEqual(["a/one", "b/two"]);
    await mock.close();
  });
});

describe("judgeCandidates", () => {
  const writer = { provider: "nvidia" as const, model: "openai/gpt-oss-20b" };

  it("prefers Gemini when configured, then Nemotron, never the writer", () => {
    vi.stubEnv("GEMINI_API_KEY", "g");
    const list = judgeCandidates(writer);
    expect(list[0]).toEqual({ provider: "gemini", model: "gemini-3.8-flash" });
    expect(list[1]).toEqual({ provider: "nvidia", model: "nvidia/nemotron-3-ultra-550b-a55b" });
    expect(list).not.toContainEqual(writer);
  });

  it("uses Nemotron first without Gemini, and drops it if it wrote the draft", () => {
    expect(judgeCandidates(writer)[0].model).toBe("nvidia/nemotron-3-ultra-550b-a55b");
    const nemotron = { provider: "nvidia" as const, model: "nvidia/nemotron-3-ultra-550b-a55b" };
    expect(judgeCandidates(nemotron)).not.toContainEqual(nemotron);
  });

  it("honours AI_JUDGE_MODEL, including gemini:<model>", () => {
    vi.stubEnv("AI_JUDGE_MODEL", "moonshotai/kimi-k3");
    expect(judgeCandidates(writer)[0]).toEqual({ provider: "nvidia", model: "moonshotai/kimi-k3" });
    vi.stubEnv("AI_JUDGE_MODEL", "gemini:gemini-x");
    expect(judgeCandidates(writer)[0]).toEqual({ provider: "gemini", model: "gemini-x" });
  });

  it("reserves the judge only when another model can still write", () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    expect(reservedJudge()?.model).toBe("nvidia/nemotron-3-ultra-550b-a55b");
    vi.stubEnv("NVIDIA_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "g");
    expect(reservedJudge()).toBeNull();
  });
});
