import { describe, expect, it } from "vitest";
import { decodeSlug, postPath } from "@/lib/post-url";
import { lexicalPlainText } from "@/lib/lexical-text";

describe("post URLs", () => {
  it("encodes slugs so trailing spaces and symbols survive", () => {
    expect(postPath("UbuTangaza ")).toBe("/UbuTangaza%20");
    expect(postPath("a/b?c")).toBe("/a%2Fb%3Fc");
  });
  it("round-trips through decodeSlug", () => {
    for (const slug of ["UbuTangaza ", "a/b?c", "plain-slug", "café"]) {
      expect(decodeSlug(postPath(slug).slice(1))).toBe(slug);
    }
  });
  it("leaves a malformed escape alone", () => {
    expect(decodeSlug("100%")).toBe("100%");
  });
});

describe("lexicalPlainText", () => {
  it("joins text across paragraphs and headings", () => {
    const doc = {
      root: {
        children: [
          { type: "heading", children: [{ text: "Title" }] },
          { type: "paragraph", children: [{ text: "Hello " }, { text: "world." }] },
        ],
      },
    };
    expect(lexicalPlainText(doc)).toBe("Title Hello world.");
  });
  it("handles empty content", () => {
    expect(lexicalPlainText(null)).toBe("");
  });
});
