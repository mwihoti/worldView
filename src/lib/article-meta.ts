import { chatCompletion } from "./ai";
import { SECTION_ORDER, CATEGORIES, categoryBySlug } from "./category";

/*
 * The fields around an article that editors otherwise fill in by hand after
 * "Generate draft": a one-sentence summary (the standfirst under the
 * headline), a meta description for search results, and the section. One
 * small call, run alongside the self-review loop so it adds no waiting.
 */

export type ArticleMeta = {
  summary: string | null;
  metaDescription: string | null;
  /* A section slug (world, sports, movies-tv, technology). */
  section: string | null;
};

const SECTIONS = SECTION_ORDER.map((id) => CATEGORIES[id]);

const SYSTEM_PROMPT = `You prepare the metadata for a news article on WorldView.

Reply with ONLY a single JSON object and nothing else, in exactly this shape:
{"summary": "<one sentence, at most 160 characters, that makes someone want to read on; do not repeat the title>", "metaDescription": "<at most 155 characters for search results, plain and specific>", "section": "<one of: ${SECTIONS.map((c) => c.slug).join(", ")}>"}

Sections: ${SECTIONS.map((c) => `${c.slug} = ${c.blurb}`).join(" ")}`;

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trimEnd()}…`;
}

export function parseArticleMeta(raw: string): ArticleMeta | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const section = typeof parsed.section === "string" ? categoryBySlug(parsed.section.trim().toLowerCase()) : undefined;
  const meta: ArticleMeta = {
    summary: clip(parsed.summary, 160),
    metaDescription: clip(parsed.metaDescription, 155),
    section: section?.slug ?? null,
  };
  return meta.summary || meta.metaDescription || meta.section ? meta : null;
}

/* Null when the call fails or there isn't time: the fields just stay empty. */
export async function describeArticle(markdown: string, budgetMs: number): Promise<ArticleMeta | null> {
  if (budgetMs < 8_000) return null;
  try {
    const raw = await chatCompletion(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: markdown.slice(0, 12_000) },
      ],
      { maxTokens: 300, budgetMs }
    );
    return parseArticleMeta(raw);
  } catch {
    return null;
  }
}
