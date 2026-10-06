import { describe, expect, it } from "vitest";
import { assertFetchableUrl, extractUrls, fetchPageText, htmlToText, isPublicAddress } from "@/lib/brief-sources";

describe("isPublicAddress", () => {
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });
  it.each([
    "127.0.0.1",
    "10.0.0.5",
    "172.16.4.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "not-an-ip",
  ])("blocks %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });
});

describe("assertFetchableUrl", () => {
  it("accepts ordinary web pages", () => {
    expect(assertFetchableUrl("https://example.com/a?b=1").hostname).toBe("example.com");
  });
  it.each([
    ["file:///etc/passwd", /only http/],
    ["ftp://example.com", /only http/],
    ["http://localhost:3000", /public/],
    ["http://metadata.internal/", /public/],
    ["http://169.254.169.254/latest", /public/],
    ["http://[::1]/", /public/],
    ["http://2130706433/", /public/],
    ["http://0x7f000001/", /public/],
    ["https://user:pw@example.com", /credentials/],
  ])("refuses %s", (url, message) => {
    expect(() => assertFetchableUrl(url)).toThrow(message);
  });
});

describe("fetchPageText", () => {
  it("never connects to private addresses", async () => {
    await expect(fetchPageText("http://127.0.0.1:1/")).rejects.toThrow(/public/);
  });
});

describe("extractUrls / htmlToText", () => {
  it("finds up to three unique links and trims trailing punctuation", () => {
    expect(extractUrls("see https://a.com/x, https://a.com/x and (https://b.com). also https://c.com https://d.com")).toEqual([
      "https://a.com/x",
      "https://b.com",
      "https://c.com",
    ]);
  });
  it("turns HTML into readable lines", () => {
    expect(htmlToText("<h1>Title</h1><script>x()</script><p>One &amp; two</p><p>Three</p>")).toBe(
      "Title\nOne & two\nThree"
    );
  });
});
