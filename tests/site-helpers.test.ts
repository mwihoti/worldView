import { describe, expect, it } from "vitest";
import { CATEGORIES, categoryBySlug, categoryFor, sectionHref } from "@/lib/category";
import { formatDate, timeAgo } from "@/lib/dates";

describe("timeAgo", () => {
  const now = Date.parse("2026-10-06T12:00:00Z");
  it("is relative within a week", () => {
    expect(timeAgo("2026-10-06T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-10-06T11:15:00Z", now)).toBe("45 minutes ago");
    expect(timeAgo("2026-10-06T10:00:00Z", now)).toBe("2 hours ago");
    expect(timeAgo("2026-10-05T12:00:00Z", now)).toBe("yesterday");
    expect(timeAgo("2026-10-02T12:00:00Z", now)).toBe("4 days ago");
  });
  it("falls back to a date after a week, and nothing for bad input", () => {
    expect(timeAgo("2024-08-14T08:00:00Z", now)).toBe("Aug 14, 2024");
    expect(timeAgo(null, now)).toBeNull();
    expect(timeAgo("not a date", now)).toBeNull();
    expect(formatDate("2024-05-20T10:00:00Z")).toBe("May 20, 2024");
  });
});

describe("sections", () => {
  it("label posts by author, then title keywords, else World", () => {
    expect(categoryFor({ title: "Anything", author: { name: "Dennis Wekesa" } }).label).toBe("Sports");
    expect(categoryFor({ title: "Best new film of the year", author: { name: "Nancy" } }).label).toBe("Movies & TV");
    expect(categoryFor({ title: "UbuTangaza biz", author: { name: "Nancy Ngari" } }).label).toBe("World");
  });
  it("round-trip through their URL", () => {
    for (const category of Object.values(CATEGORIES)) {
      const slug = new URL(sectionHref(category), "http://x").searchParams.get("section");
      expect(categoryBySlug(slug)).toBe(category);
    }
    expect(categoryBySlug("nope")).toBeUndefined();
  });
});
