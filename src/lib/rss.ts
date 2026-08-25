import { XMLParser } from "fast-xml-parser";
import { env } from "./env";
import { FullPost, PostsPage } from "./types";

/*
 * Hashnode's GraphQL API requires a paid Pro plan since May 2026, but every
 * Hashnode blog still serves a free public RSS feed with the full article
 * HTML. This module is the fallback data source built on that feed.
 */

type RssEnclosure = { "@_url"?: string };

type RssItem = {
  title?: string;
  description?: string;
  link?: string;
  guid?: string | { "#text"?: string };
  "dc:creator"?: string;
  pubDate?: string;
  enclosure?: RssEnclosure;
  "content:encoded"?: string;
};

function toPost(item: RssItem): FullPost | null {
  if (!item.link || !item.title) return null;

  let slug: string;
  try {
    slug = new URL(item.link).pathname.replace(/^\/+|\/+$/g, "");
  } catch {
    return null;
  }
  if (!slug) return null;

  const coverUrl = item.enclosure?.["@_url"];

  return {
    id: typeof item.guid === "object" ? item.guid["#text"] ?? item.link : item.guid ?? item.link,
    title: item.title,
    slug,
    brief: item.description ?? null,
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
    coverImage: coverUrl ? { url: coverUrl } : null,
    author: { name: item["dc:creator"] ?? "WorldView" },
    content: { html: item["content:encoded"] ?? "" },
  };
}

export async function getRssPosts(): Promise<FullPost[]> {
  try {
    const response = await fetch(env.NEXT_PUBLIC_HASHNODE_RSS_URL, {
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      console.error(`RSS feed request failed with status ${response.status}`);
      return [];
    }

    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(await response.text());
    const rawItems = parsed?.rss?.channel?.item ?? [];
    const items: RssItem[] = Array.isArray(rawItems) ? rawItems : [rawItems];

    return items.map(toPost).filter((post): post is FullPost => post !== null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`RSS feed request failed: ${message.slice(0, 200)}`);
    return [];
  }
}

export async function getRssPostsPage(): Promise<PostsPage> {
  const posts = await getRssPosts();
  return {
    edges: posts.map((post) => ({ node: post, cursor: post.id })),
    pageInfo: { hasNextPage: false, endCursor: null },
  };
}

export async function getRssPostBySlug(slug: string): Promise<FullPost | null> {
  const posts = await getRssPosts();
  return posts.find((post) => post.slug === slug) ?? null;
}
