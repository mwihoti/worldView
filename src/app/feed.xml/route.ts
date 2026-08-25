import { getPosts, getPublication } from "@/lib/requests";
import { siteUrl } from "@/lib/env";

export const revalidate = 3600;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const [publication, { edges }] = await Promise.all([
    getPublication(),
    getPosts({ first: 20 }),
  ]);

  const title = publication.displayTitle || publication.title;

  const items = edges
    .map(({ node }) => {
      const url = `${siteUrl}/${node.slug}`;
      return `    <item>
      <title>${escapeXml(node.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      ${node.publishedAt ? `<pubDate>${new Date(node.publishedAt).toUTCString()}</pubDate>` : ""}
      <author>${escapeXml(node.author.name)}</author>
      ${node.brief ? `<description>${escapeXml(node.brief)}</description>` : ""}
    </item>`;
    })
    .join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(publication.descriptionSEO || title)}</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
