import { afterEach, describe, expect, it, vi } from "vitest";
import { parseArticleMeta } from "@/lib/article-meta";
import { draftArticleMarkdown } from "@/lib/article-loop";
import { expandBriefWithSources } from "@/lib/brief-sources";
import { categoryFor } from "@/lib/category";
import { sourcesText } from "@/components/admin/ai-stream";
import { ARTICLE, startMockLLM } from "./helpers/mock-llm";

describe("parseArticleMeta", () => {
  it("reads summary, search description and a known section", () => {
    expect(
      parseArticleMeta(
        'Here: {"summary": "A Kenyan startup pays customers for referrals.", "metaDescription": "How UbuTangaza works.", "section": "Technology"}'
      )
    ).toEqual({
      summary: "A Kenyan startup pays customers for referrals.",
      metaDescription: "How UbuTangaza works.",
      section: "technology",
    });
  });

  it("drops unknown sections and trims long text at a word", () => {
    const meta = parseArticleMeta(JSON.stringify({ summary: "word ".repeat(80), section: "politics" }))!;
    expect(meta.section).toBeNull();
    expect(meta.summary!.length).toBeLessThanOrEqual(160);
    expect(meta.summary!.endsWith("…")).toBe(true);
    expect(meta.metaDescription).toBeNull();
  });

  it("returns null for garbage", () => {
    expect(parseArticleMeta("no json here")).toBeNull();
    expect(parseArticleMeta("{}")).toBeNull();
  });
});

describe("section choice", () => {
  it("a section set in the CMS wins over the author/title guess", () => {
    const post = { title: "Premier League transfers", author: { name: "Dennis" } };
    expect(categoryFor(post).label).toBe("Sports");
    expect(categoryFor({ ...post, section: "technology" }).label).toBe("Technology");
    expect(categoryFor({ ...post, section: "bogus" }).label).toBe("Sports");
  });
});

describe("linked sources", () => {
  it("reports each link's outcome and keeps failures in the brief", async () => {
    const { brief, sources } = await expandBriefWithSources("Write about http://127.0.0.1:9/x and http://localhost/y");
    expect(sources).toEqual([
      { url: "http://127.0.0.1:9/x", ok: false, reason: "not a public address" },
      { url: "http://localhost/y", ok: false, reason: "not a public address" },
    ]);
    expect(brief).toContain("Could not fetch this page");
  });

  it("summarises them for the admin", () => {
    expect(sourcesText([{ url: "https://a.com/1", ok: true, chars: 10 }])).toBe("Read the linked page");
    expect(
      sourcesText([
        { url: "https://www.a.com/1", ok: true, chars: 10 },
        { url: "https://b.org/2", ok: false, reason: "HTTP 403" },
      ])
    ).toBe("Read 1 of 2 linked pages · couldn't read b.org (HTTP 403)");
  });

  it("has nothing to report without links", async () => {
    expect(await expandBriefWithSources("Just a topic")).toEqual({ brief: "Just a topic", sources: [] });
  });
});

describe("draftArticleMarkdown", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns the draft with its suggested summary, search description and section", async () => {
    const mock = await startMockLLM(({ messages, isJudge }) => {
      if (isJudge) return '{"score": 9, "ready": true}';
      if (String(messages[0].content).includes("You prepare the metadata")) {
        return '{"summary": "Rain floods Nairobi roads.", "metaDescription": "Nairobi long rains.", "section": "world"}';
      }
      return ARTICLE;
    });
    vi.stubEnv("NVIDIA_API_KEY", "k");
    vi.stubEnv("NVIDIA_ENDPOINT", mock.url);
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("NVIDIA_MODEL", "");
    vi.stubEnv("AI_JUDGE_MODEL", "");
    const events: string[] = [];
    const result = await draftArticleMarkdown("Rain in Nairobi", undefined, {
      onProgress: (e) => events.push(e.stage),
    });
    expect(result.title).toBe("A Headline");
    expect(result.review.outcome).toBe("approved");
    expect(result.meta).toEqual({
      summary: "Rain floods Nairobi roads.",
      metaDescription: "Nairobi long rains.",
      section: "world",
    });
    expect(result.sources).toEqual([]);
    expect(events).toEqual(["drafting", "reviewing", "done"]);
    await mock.close();
  });
});
