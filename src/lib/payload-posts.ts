import { cache } from "react";
import { getPayload } from "payload";
import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html";
import config from "@payload-config";
import type { Post } from "@/payload-types";
import { lexicalPlainText } from "./lexical-text";
import { FullPost, PostEdge, PostNode } from "./types";

/*
 * Posts authored in the Payload admin (/admin). Wrapped in try/catch so the
 * public site keeps working when the database isn't provisioned yet.
 *
 * Lists never render article bodies, so they don't convert any rich text to
 * HTML (the brief comes straight from the editor's text nodes), and a single
 * post is fetched by slug rather than by loading everything and searching.
 * Both are memoised per request with React's cache(): a post page asks for
 * its post in generateMetadata and again in the page, and for the list in
 * the related-posts strip.
 */

function toBrief(content: unknown): string {
  return lexicalPlainText(content, 300).slice(0, 240);
}

function toNode(doc: Post): PostNode {
  const cover =
    doc.cover && typeof doc.cover === "object" && doc.cover.url
      ? { url: doc.cover.url }
      : null;
  return {
    id: `payload-${doc.id}`,
    title: doc.title,
    slug: doc.slug ?? String(doc.id),
    brief: toBrief(doc.content),
    publishedAt: doc.publishedAt ?? doc.createdAt ?? null,
    coverImage: cover,
    author: { name: doc.author || "WorldView" },
  };
}

function logUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Payload posts unavailable: ${message.slice(0, 200)}`);
}

export const getPayloadPostEdges = cache(async (): Promise<PostEdge[]> => {
  try {
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: "posts",
      where: { _status: { equals: "published" } },
      sort: "-publishedAt",
      // Every published post: the site, feed and sitemap list them all.
      pagination: false,
      depth: 1,
      select: {
        title: true,
        slug: true,
        author: true,
        publishedAt: true,
        createdAt: true,
        cover: true,
        content: true,
      },
    });
    return result.docs.map((doc) => {
      const node = toNode(doc as Post);
      return { node, cursor: node.id };
    });
  } catch (error) {
    logUnavailable(error);
    return [];
  }
});

export const getPayloadPostBySlug = cache(
  async (slug: string): Promise<FullPost | null> => {
    try {
      const payload = await getPayload({ config });
      const { docs } = await payload.find({
        collection: "posts",
        where: {
          and: [{ slug: { equals: slug } }, { _status: { equals: "published" } }],
        },
        limit: 1,
        depth: 1,
      });
      const doc = docs[0];
      if (!doc) return null;
      const html = doc.content ? convertLexicalToHTML({ data: doc.content }) : "";
      return { ...toNode(doc), content: { html } };
    } catch (error) {
      logUnavailable(error);
      return null;
    }
  }
);
