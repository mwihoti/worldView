import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import Byline from "@/components/byline";
import PostCover from "@/components/post-cover";
import ReadingProgress from "@/components/reading-progress";
import SectionHeader from "@/components/section-header";
import ShareButton from "@/components/share-button";
import StoryCard from "@/components/story-card";
import { categoryFor, sectionHref } from "@/lib/category";
import { getPostBySlug, getPosts } from "@/lib/requests";
import { siteUrl } from "@/lib/env";
import { decodeSlug, postPath } from "@/lib/post-url";
import { readingMinutes } from "@/lib/reading-time";
import { sanitizeArticleHtml } from "@/lib/sanitize";

export const revalidate = 300;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const { edges } = await getPosts({ first: 20 });
  return edges.map((edge) => ({ slug: edge.node.slug }));
}

/* The uploaded cover when there is one, else the generated PNG card (social
 * sites don't accept the SVG cover art). */
function shareImage(post: { slug: string; title: string; coverImage?: { url: string } | null }) {
  return post.coverImage
    ? { url: post.coverImage.url, alt: post.title }
    : { url: `/og/${encodeURIComponent(post.slug)}`, width: 1200, height: 630, alt: post.title };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = decodeSlug((await params).slug);
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Post not found" };

  const description = post.seoDescription || post.subtitle || post.brief || undefined;
  const image = shareImage(post);

  return {
    title: post.title,
    description,
    openGraph: {
      type: "article",
      title: post.title,
      description,
      publishedTime: post.publishedAt ?? undefined,
      authors: [post.author.name],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [image.url],
    },
    alternates: {
      canonical: postPath(post.slug),
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const slug = decodeSlug((await params).slug);
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    description: post.seoDescription || post.subtitle || post.brief || undefined,
    image: [new URL(shareImage(post).url, siteUrl).toString()],
    datePublished: post.publishedAt ?? undefined,
    author: [{ "@type": "Person", name: post.author.name }],
    mainEntityOfPage: `${siteUrl}${postPath(post.slug)}`,
    publisher: { "@type": "Organization", name: "WorldView", url: siteUrl },
  };

  const category = categoryFor(post);
  const html = sanitizeArticleHtml(post.content.html);
  const minutes = readingMinutes(html);

  // "More stories": others from the same section first.
  const { edges } = await getPosts({ first: 12 });
  const others = edges.map((e) => e.node).filter((n) => n.slug !== post.slug);
  const related = [
    ...others.filter((n) => categoryFor(n).id === category.id),
    ...others.filter((n) => categoryFor(n).id !== category.id),
  ].slice(0, 3);

  return (
    <>
      <ReadingProgress targetId="article-body" />

      <main id="main" className="pb-20">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            // Escape "<" so a title containing "</script>" can't break out of the tag.
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />

        <article>
          <header className="wrap pt-10 lg:pt-14">
            <div className="mx-auto max-w-3xl">
              <nav aria-label="Breadcrumb" data-enter className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/" className="hover:text-foreground">
                  Home
                </Link>
                <span aria-hidden="true">/</span>
                <Link href={sectionHref(category)} className="kicker hover:underline">
                  {category.label}
                </Link>
              </nav>

              <h1
                data-enter
                className="headline mt-5 text-[2.3rem] leading-[1.08] sm:text-5xl lg:text-[3.4rem]"
                style={{ ["--reveal-delay" as string]: "60ms" }}
              >
                {post.title}
              </h1>

              {/* Only a real subtitle: the brief is the opening paragraph, which
                  follows right below and would just repeat. */}
              {post.subtitle && (
                <p
                  data-enter
                  className="headline mt-5 text-xl font-normal leading-relaxed tracking-normal text-muted-foreground sm:text-[1.35rem]"
                  style={{ ["--reveal-delay" as string]: "120ms" }}
                >
                  {post.subtitle}
                </p>
              )}

              <div
                data-enter
                className="mt-7 flex flex-wrap items-center justify-between gap-4 border-y border-border py-4"
                style={{ ["--reveal-delay" as string]: "180ms" }}
              >
                <Byline post={post}>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" aria-hidden="true" /> {minutes} min read
                  </span>
                </Byline>
                <ShareButton title={post.title} />
              </div>
            </div>

            <figure
              data-enter
              className="mx-auto mt-9 max-w-5xl"
              style={{ ["--reveal-delay" as string]: "240ms" }}
            >
              <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--radius)] bg-muted">
                <PostCover post={post} priority sizes="(max-width: 1100px) 100vw, 1024px" />
              </div>
            </figure>
          </header>

          <div className="wrap">
            <div
              id="article-body"
              className="blog-content has-dropcap mt-12"
              dangerouslySetInnerHTML={{ __html: html }}
            />

            <footer className="mx-auto mt-14 flex max-w-[42rem] flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
              <Link href={sectionHref(category)} className="more-link">
                More from {category.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <ShareButton title={post.title} />
            </footer>
          </div>
        </article>

        {related.length > 0 && (
          <section aria-labelledby="more-stories" className="wrap mt-20">
            <SectionHeader id="more-stories" title="More stories" href="/posts" linkLabel="View all stories" />
            <div className="mt-6 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
              {related.map((node, i) => (
                <StoryCard key={node.id} post={node} index={i} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
