import type { MetadataRoute } from "next";
import { getPosts } from "@/lib/requests";
import { siteUrl } from "@/lib/env";
import { postPath } from "@/lib/post-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { edges } = await getPosts({ first: 50 });

  const posts: MetadataRoute.Sitemap = edges.map((edge) => ({
    url: `${siteUrl}${postPath(edge.node.slug)}`,
    lastModified: edge.node.publishedAt
      ? new Date(edge.node.publishedAt)
      : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: siteUrl,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${siteUrl}/posts`,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    ...posts,
  ];
}
