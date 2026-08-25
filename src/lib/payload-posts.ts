import { getPayload } from "payload";
import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html";
import config from "@payload-config";
import { FullPost, PostEdge } from "./types";

function toBrief(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

/*
 * Posts authored in the Payload admin (/admin). Wrapped in try/catch so the
 * public site keeps working when the database isn't provisioned yet.
 */
export async function getPayloadPosts(): Promise<FullPost[]> {
  try {
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: "posts",
      where: { _status: { equals: "published" } },
      sort: "-publishedAt",
      limit: 100,
      depth: 1,
    });

    return result.docs.map((doc) => {
      const cover =
        doc.cover && typeof doc.cover === "object" && doc.cover.url
          ? { url: doc.cover.url }
          : null;
      const html = doc.content
        ? convertLexicalToHTML({ data: doc.content })
        : "";

      return {
        id: `payload-${doc.id}`,
        title: doc.title,
        slug: doc.slug ?? String(doc.id),
        brief: toBrief(html),
        publishedAt: doc.publishedAt ?? doc.createdAt ?? null,
        coverImage: cover,
        author: { name: doc.author || "WorldView" },
        content: { html },
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Payload posts unavailable: ${message.slice(0, 200)}`);
    return [];
  }
}

export async function getPayloadPostEdges(): Promise<PostEdge[]> {
  const posts = await getPayloadPosts();
  return posts.map((post) => ({ node: post, cursor: post.id }));
}

export async function getPayloadPostBySlug(
  slug: string
): Promise<FullPost | null> {
  const posts = await getPayloadPosts();
  return posts.find((post) => post.slug === slug) ?? null;
}
