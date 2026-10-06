import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import Avatar from "@/components/avatar";
import BlogCard from "@/components/blog-card";
import CategoryTag from "@/components/category-tag";
import PostCover from "@/components/post-cover";
import PostInteractions from "@/components/post-interactions";
import ReadingProgress from "@/components/reading-progress";
import SectionHeading from "@/components/section-heading";
import ShareButton from "@/components/share-button";
import { categoryFor } from "@/lib/category";
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = decodeSlug((await params).slug);
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Post not found" };

  const description = post.brief || post.subtitle || undefined;

  return {
    title: post.title,
    description,
    openGraph: {
      type: "article",
      title: post.title,
      description,
      publishedTime: post.publishedAt ?? undefined,
      authors: [post.author.name],
      images: post.coverImage ? [{ url: post.coverImage.url }] : undefined,
    },
    twitter: {
      card: post.coverImage ? "summary_large_image" : "summary",
      title: post.title,
      description,
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
    description: post.brief || post.subtitle || undefined,
    image: post.coverImage ? [post.coverImage.url] : undefined,
    datePublished: post.publishedAt ?? undefined,
    author: [{ "@type": "Person", name: post.author.name }],
    mainEntityOfPage: `${siteUrl}${postPath(post.slug)}`,
  };

  const category = categoryFor(post);
  const html = sanitizeArticleHtml(post.content.html);
  const minutes = readingMinutes(html);
  const dateLong = post.publishedAt
    ? new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(post.publishedAt))
    : null;

  // "Keep reading": other stories, same section first.
  const { edges } = await getPosts({ first: 12 });
  const others = edges.map((e) => e.node).filter((n) => n.slug !== post.slug);
  const related = [
    ...others.filter((n) => categoryFor(n).id === category.id),
    ...others.filter((n) => categoryFor(n).id !== category.id),
  ].slice(0, 3);

  return (
    <>
      <ReadingProgress targetId="article-body" />

      <main id="main" className="wrap pb-6 pt-4 sm:pt-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            // Escape "<" so a title containing "</script>" can't break out of the tag.
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />

        <Link href="/" className="nav-link mb-8">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All stories
        </Link>

        <article data-cat={category.id}>
          <header className="mx-auto max-w-3xl text-center">
            <div
              data-enter
              className="flex flex-wrap items-center justify-center gap-3"
            >
              <CategoryTag category={category} />
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                <Clock className="h-4 w-4" aria-hidden="true" /> {minutes} min read
              </span>
            </div>

            <h1
              data-enter
              className="font-display mt-5 text-[2.5rem] font-bold leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl"
              style={{ ["--reveal-delay" as string]: "80ms" }}
            >
              {post.title}
            </h1>

            {post.subtitle && (
              <p
                data-enter
                className="mx-auto mt-5 max-w-2xl text-xl leading-relaxed text-muted-foreground"
                style={{ ["--reveal-delay" as string]: "160ms" }}
              >
                {post.subtitle}
              </p>
            )}

            <div
              data-enter
              className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-3"
              style={{ ["--reveal-delay" as string]: "240ms" }}
            >
              <span className="inline-flex items-center gap-3">
                <Avatar
                  name={post.author.name}
                  src={post.author.profilePicture}
                  size={42}
                />
                <span className="text-left leading-tight">
                  <span className="block font-bold">{post.author.name}</span>
                  {dateLong && post.publishedAt && (
                    <time
                      dateTime={post.publishedAt}
                      className="text-sm text-muted-foreground"
                    >
                      {dateLong}
                    </time>
                  )}
                </span>
              </span>
              <ShareButton title={post.title} />
            </div>
          </header>

          <div
            data-enter="pop"
            className="relative mx-auto mt-10 max-w-4xl"
            style={{ ["--reveal-delay" as string]: "320ms" }}
          >
            <div className="tape relative -rotate-[0.6deg]">
              <div className="sticker relative aspect-[16/9] overflow-hidden !rounded-xl">
                <div
                  className="parallax absolute inset-x-0 -top-[8%] h-[116%]"
                  style={{ ["--speed" as string]: 0.06 }}
                >
                  <PostCover
                    post={post}
                    priority
                    sizes="(max-width: 1024px) 100vw, 896px"
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            id="article-body"
            className="blog-content has-dropcap mt-14"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          <div data-reveal className="mx-auto mt-14 flex max-w-xs items-center justify-center gap-3 text-muted-foreground">
            <svg viewBox="0 0 160 14" className="draw h-4 w-full text-primary" fill="none" aria-hidden="true">
              <path
                d="M2 8 Q 12 0 22 8 T 42 8 T 62 8 T 82 8 T 102 8 T 122 8 T 142 8 T 158 7"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                pathLength="1"
              />
            </svg>
          </div>

          <PostInteractions />
        </article>

        {related.length > 0 && (
          <section className="mt-24" aria-label="Keep reading">
            <SectionHeading eyebrow="don't stop now" title="Keep reading" />
            <div className="mt-8 grid grid-cols-1 gap-x-7 gap-y-9 md:grid-cols-2 lg:grid-cols-3">
              {related.map((node, i) => (
                <BlogCard key={node.id} post={node} index={i} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
