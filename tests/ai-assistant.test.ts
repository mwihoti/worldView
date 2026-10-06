import { describe, expect, it } from "vitest";
import { extractArticle } from "@/lib/ai-assistant";

describe("extractArticle", () => {
  it("treats a reply starting with '# ' as a full revision", () => {
    expect(extractArticle("# Title\n\nBody")).toEqual({
      reply: "Here's the revised article.",
      article: "# Title\n\nBody",
    });
  });
  it("keeps any prose before the heading as the reply", () => {
    expect(extractArticle("Sure, tightened it.\n\n# Title\n\nBody")).toEqual({
      reply: "Sure, tightened it.",
      article: "# Title\n\nBody",
    });
  });
  it("a plain answer proposes no change", () => {
    expect(extractArticle("The second section is the strongest.")).toEqual({
      reply: "The second section is the strongest.",
      article: null,
    });
  });
  it("## subheadings alone are not a revision", () => {
    expect(extractArticle("## Not a title").article).toBeNull();
  });
});
