import { describe, expect, it } from "vitest";
import { sanitizeArticleHtml } from "@/lib/sanitize";

describe("sanitizeArticleHtml", () => {
  it("removes scripts, event handlers and dangerous links", () => {
    const dirty =
      '<p onclick="steal()">Hi<script>alert(1)</script></p>' +
      '<a href="javascript:alert(1)">x</a><a href="data:text/html,hi">y</a>' +
      '<img src="x" onerror="alert(1)"><style>body{}</style>' +
      '<iframe src="https://evil.example/"></iframe>';
    const clean = sanitizeArticleHtml(dirty);
    expect(clean).not.toMatch(/script|onclick|onerror|javascript:|data:|<style|evil\.example/i);
    expect(clean).toContain("<p>Hi</p>");
  });

  it("keeps the formatting articles use", () => {
    const html =
      '<h2 id="intro">Intro</h2><p><strong>Bold</strong> and <em>italic</em> <a href="https://example.com">link</a></p>' +
      '<ul><li>one</li></ul><blockquote>quote</blockquote><pre><code class="language-ts">let a = 1;</code></pre>' +
      '<table><tbody><tr><td colspan="2">cell</td></tr></tbody></table><img src="https://cdn.example/a.png" alt="A">' +
      '<iframe src="https://www.youtube.com/embed/abc"></iframe>';
    const clean = sanitizeArticleHtml(html);
    for (const part of [
      '<h2 id="intro">',
      "<strong>Bold</strong>",
      'href="https://example.com"',
      "<li>one</li>",
      "<blockquote>",
      'class="language-ts"',
      'colspan="2"',
      'src="https://cdn.example/a.png"',
      'src="https://www.youtube.com/embed/abc"',
    ]) {
      expect(clean).toContain(part);
    }
  });

  it("adds noopener to links that open a new tab", () => {
    expect(sanitizeArticleHtml('<a href="https://x.example" target="_blank">x</a>')).toContain(
      'rel="noopener noreferrer"'
    );
  });
});
