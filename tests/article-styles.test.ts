import { describe, expect, it } from "vitest";
import { ARTICLE_STYLES, articleStyle, exampleBlock } from "@/lib/article-styles";

describe("articleStyle", () => {
  it("finds every defined style by id", () => {
    for (const style of ARTICLE_STYLES) {
      expect(articleStyle(style.id)).toBe(style);
    }
  });

  it("returns undefined for unknown, empty and missing ids", () => {
    expect(articleStyle("sonnet")).toBeUndefined();
    expect(articleStyle("")).toBeUndefined();
    expect(articleStyle(null)).toBeUndefined();
    expect(articleStyle(undefined)).toBeUndefined();
  });

  it("gives every style the prompt fragments the loop splices in", () => {
    for (const style of ARTICLE_STYLES) {
      expect(style.writer.length).toBeGreaterThan(40);
      expect(style.judge.length).toBeGreaterThan(40);
      expect(style.label.length).toBeGreaterThan(0);
    }
  });
});

describe("exampleBlock", () => {
  it("is empty with no examples, so the default prompt is unchanged", () => {
    expect(exampleBlock([])).toBe("");
  });

  it("wraps each example and tells the model to copy voice, not facts", () => {
    const block = exampleBlock(["# One\n\nBody one", "# Two\n\nBody two"]);
    expect(block).toContain("<example>\n# One\n\nBody one\n</example>");
    expect(block).toContain("<example>\n# Two\n\nBody two\n</example>");
    expect(block).toMatch(/never their topic/);
  });

  it("truncates oversized examples so two of them can't crowd out the brief", () => {
    const block = exampleBlock(["x".repeat(10_000)]);
    expect(block.length).toBeLessThan(3_000);
  });
});
