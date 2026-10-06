/*
 * The site's sections. There is no category field on a post: sections are
 * identified by author (Sports is Dennis's, Movies & TV is Danny's,
 * Technology is Daniel's), with a keyword fallback on the title for everyone
 * else; whatever is left is World. Labels, covers and section pages all hang
 * off the result.
 */

export type CategoryId = "sports" | "screen" | "tech" | "story";

export type Category = {
  id: CategoryId;
  label: string;
  /* URL value for /posts?section=… */
  slug: string;
  /* The author whose posts make up this section, if it has one. */
  author?: string;
  blurb: string;
};

export const CATEGORIES: Record<CategoryId, Category> = {
  story: {
    id: "story",
    label: "World",
    slug: "world",
    blurb: "News, ideas and stories from around the world.",
  },
  sports: {
    id: "sports",
    label: "Sports",
    slug: "sports",
    author: "Dennis",
    blurb: "Transfers, tables and takes from the pitch.",
  },
  screen: {
    id: "screen",
    label: "Movies & TV",
    slug: "movies-tv",
    author: "Danny",
    blurb: "What to watch, what to skip, what to rewatch.",
  },
  tech: {
    id: "tech",
    label: "Technology",
    slug: "technology",
    author: "Daniel",
    blurb: "Gadgets, code, startups and the odd blockchain.",
  },
};

/* Navigation order, as on the masthead. */
export const SECTION_ORDER: CategoryId[] = ["story", "sports", "screen", "tech"];

export function categoryBySlug(slug: string | undefined | null): Category | undefined {
  return SECTION_ORDER.map((id) => CATEGORIES[id]).find((c) => c.slug === slug);
}

export function sectionHref(category: Category): string {
  return `/posts?section=${category.slug}`;
}

const BY_AUTHOR: Record<string, CategoryId> = {
  dennis: "sports",
  danny: "screen",
  daniel: "tech",
};

const KEYWORDS: [RegExp, CategoryId][] = [
  [/premier league|transfer|fpl|football|fantasy|goal|match|league/i, "sports"],
  [/movie|film|tv|show|series|cinema|netflix/i, "screen"],
  [/tech|ai\b|blockchain|avalanche|crypto|app|software|startup|gadget|code/i, "tech"],
];

export function categoryFor(post: {
  title: string;
  author: { name: string };
}): Category {
  const firstName = post.author.name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const byAuthor = BY_AUTHOR[firstName];
  if (byAuthor) return CATEGORIES[byAuthor];
  for (const [pattern, id] of KEYWORDS) {
    if (pattern.test(post.title)) return CATEGORIES[id];
  }
  return CATEGORIES.story;
}
