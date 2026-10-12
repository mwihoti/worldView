import { describe, expect, it } from "vitest";
import { WRITING_GUIDE, WRITING_JUDGE_CRITERIA } from "@/lib/writing-guide";

/*
 * The guide is prompt text, so these tests pin its contract rather than its
 * wording: it must stay small enough to ship with every call, and it must
 * keep covering the rules the full skill (docs/article-writing-skill.md)
 * considers non-negotiable — if a rewrite drops one, a test goes red.
 */

describe("WRITING_GUIDE", () => {
  it("stays small enough to send with every model call", () => {
    expect(WRITING_GUIDE.length).toBeGreaterThan(500);
    expect(WRITING_GUIDE.length).toBeLessThan(4_000);
  });

  it("keeps the skill's core rules", () => {
    // Generic openings and endings, the most recognizable tells.
    expect(WRITING_GUIDE).toMatch(/In today's world/);
    expect(WRITING_GUIDE).toMatch(/Ultimately/);
    // Stock constructions and filler.
    expect(WRITING_GUIDE).toMatch(/not just X, but Y/);
    expect(WRITING_GUIDE).toMatch(/important to note/i);
    // Buzzword bar and plain-word preference.
    expect(WRITING_GUIDE).toMatch(/game-changing/);
    expect(WRITING_GUIDE).toMatch(/leverage/);
    // No invented evidence, no manufactured errors.
    expect(WRITING_GUIDE).toMatch(/Never invent statistics/i);
    expect(WRITING_GUIDE).toMatch(/never means sloppy/i);
  });
});

describe("WRITING_JUDGE_CRITERIA", () => {
  it("tells the judge to send generic prose back", () => {
    expect(WRITING_JUDGE_CRITERIA).toMatch(/machine-made writing/);
    expect(WRITING_JUDGE_CRITERIA).toMatch(/different topic/);
    expect(WRITING_JUDGE_CRITERIA.length).toBeLessThan(1_500);
  });
});
