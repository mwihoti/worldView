import { categoryFor } from "@/lib/category";
import { ogCard } from "@/lib/og-card";
import { decodeSlug } from "@/lib/post-url";
import { getPostBySlug } from "@/lib/requests";

/* GET /og/<slug> — the share image for a post without an uploaded cover. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeSlug((await params).slug);
  const post = await getPostBySlug(slug);
  if (!post) return new Response("Not found", { status: 404 });
  const category = categoryFor(post);
  return ogCard({ title: post.title, eyebrow: `WorldView · ${category.label}`, seed: post.slug, category: category.id });
}
