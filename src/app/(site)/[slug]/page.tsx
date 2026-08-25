import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import PostInteractions from "@/components/post-interactions";
import { Button } from "@/components/ui/button";
import { getPostBySlug, getPosts } from "@/lib/requests";
import { siteUrl } from "@/lib/env";

export const revalidate = 300;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const { edges } = await getPosts({ first: 20 });
  return edges.map((edge) => ({ slug: edge.node.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
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
      canonical: `/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
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
    mainEntityOfPage: `${siteUrl}/${post.slug}`,
  };

  return (
    <div className="max-w-7xl w-full px-3 xl:px-0 mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Button asChild variant="outline" className="mb-4">
        <Link href="/" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </Button>

      <article className="max-w-4xl mx-auto">
        {post.coverImage && (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg">
            <Image
              src={post.coverImage.url}
              alt={post.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 896px"
              className="object-cover"
            />
          </div>
        )}

        <h1 className="text-4xl lg:text-6xl text-center leading-tight font-bold mt-8">
          {post.title}
        </h1>

        {post.subtitle && (
          <p className="my-5 text-center text-xl text-muted-foreground">
            {post.subtitle}
          </p>
        )}

        <div className="my-5 flex items-center justify-center gap-3 text-lg">
          {post.author.profilePicture && (
            <Image
              src={post.author.profilePicture}
              alt={post.author.name}
              width={40}
              height={40}
              className="rounded-full"
            />
          )}
          <span>{post.author.name}</span>
          {post.publishedAt && (
            <>
              <span className="text-muted-foreground">·</span>
              <time
                dateTime={post.publishedAt}
                className="text-muted-foreground"
              >
                {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                  new Date(post.publishedAt)
                )}
              </time>
            </>
          )}
        </div>

        <div
          className="blog-content text-xl leading-loose flex flex-col gap-5 mt-5"
          dangerouslySetInnerHTML={{ __html: post.content.html }}
        />

        <PostInteractions />
      </article>
    </div>
  );
}
