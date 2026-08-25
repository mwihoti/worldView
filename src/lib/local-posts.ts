import { marked } from "marked";
import { localPosts } from "@/content/posts";
import { FullPost, PostEdge } from "./types";

function toBrief(markdown: string): string {
  return markdown
    .replace(/[#*_>`]/g, "")
    .replace(/^\s*[-\d.]+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export function getLocalPosts(): FullPost[] {
  return localPosts.map((post) => ({
    id: `local-${post.slug}`,
    title: post.title,
    slug: post.slug,
    brief: toBrief(post.markdown),
    publishedAt: post.publishedAt,
    coverImage: post.cover ? { url: post.cover } : null,
    author: { name: post.author },
    content: { html: marked.parse(post.markdown, { async: false }) },
  }));
}

export function getLocalPostEdges(): PostEdge[] {
  return getLocalPosts().map((post) => ({ node: post, cursor: post.id }));
}

export function getLocalPostBySlug(slug: string): FullPost | null {
  return getLocalPosts().find((post) => post.slug === slug) ?? null;
}
