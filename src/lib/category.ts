/*
 * The site's sections. There is no category field on a post: sections are
 * identified by author (the navbar has always linked "Sports" to Dennis's
 * posts, "Movies & TV Shows" to Danny's and "Tech" to Daniel's), so that
 * mapping is kept here, with a keyword fallback on the title for everyone
 * else. Everything else — colours, covers, tags — hangs off the result.
 */

export type CategoryId = "sports" | "screen" | "tech" | "story";

export type Category = {
  id: CategoryId;
  label: string;
  /* The author query the navbar uses to list this section, if it has one. */
  author?: string;
  blurb: string;
};

export const CATEGORIES: Record<CategoryId, Category> = {
  sports: {
    id: "sports",
    label: "Sports",
    author: "Dennis",
    blurb: "Transfers, tables and takes from the pitch.",
  },
  screen: {
    id: "screen",
    label: "Movies & TV",
    author: "Danny",
    blurb: "What to watch, what to skip, what to rewatch.",
  },
  tech: {
    id: "tech",
    label: "Tech",
    author: "Daniel",
    blurb: "Gadgets, code and the odd blockchain.",
  },
  story: {
    id: "story",
    label: "Stories",
    blurb: "Everything else worth a few minutes.",
  },
};

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
