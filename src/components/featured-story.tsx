import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Byline from "./byline";
import PostCover from "./post-cover";
import { categoryFor } from "@/lib/category";
import { postPath } from "@/lib/post-url";
import type { PostNode } from "@/lib/types";

/* The lead story: a big picture beside a big headline. */
export default function FeaturedStory({ post }: { post: PostNode }) {
  const category = categoryFor(post);
  const href = postPath(post.slug);

  return (
    <article className="featured group relative grid items-center gap-7 md:grid-cols-[1.12fr_1fr] md:gap-10">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="block">
        <div data-enter className="relative aspect-[16/10.2] overflow-hidden rounded-[var(--radius)] bg-muted">
          <div className="cover-zoom absolute inset-0">
            <PostCover post={post} priority sizes="(max-width: 768px) 100vw, 570px" />
          </div>
        </div>
      </Link>

      <div data-enter style={{ ["--reveal-delay" as string]: "90ms" }}>
        <p className="kicker text-[0.8rem]">{category.label}</p>
        <h2 className="headline mt-4 text-[2.15rem] leading-[1.1] sm:text-[2.6rem] xl:text-[2.95rem]">
          <Link href={href}>
            <span className="title-link">{post.title}</span>
          </Link>
        </h2>
        {(post.subtitle || post.brief) && (
          <p className="headline mt-5 line-clamp-4 text-[1.05rem] font-normal leading-relaxed tracking-normal text-muted-foreground">
            {post.subtitle || post.brief}
          </p>
        )}
        <Byline post={post} className="mt-5" />
        <Link href={href} className="more-link mt-6 text-lg">
          Read story <ArrowRight className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">: {post.title}</span>
        </Link>
      </div>
    </article>
  );
}
