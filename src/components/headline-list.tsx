import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { categoryFor } from "@/lib/category";
import { timeAgo } from "@/lib/dates";
import { postPath } from "@/lib/post-url";
import type { PostNode } from "@/lib/types";

/* "Latest headlines": section, headline and how long ago, divided by rules. */
export default function HeadlineList({ posts, title = "Latest headlines" }: { posts: PostNode[]; title?: string }) {
  if (posts.length === 0) return null;
  return (
    <section aria-labelledby="headlines-title">
      <h2 id="headlines-title" className="section-title text-[1.1rem]">
        {title}
      </h2>
      <ul className="mt-4">
        {posts.map((post, i) => {
          const ago = timeAgo(post.publishedAt);
          return (
            <li
              key={post.id}
              data-enter
              style={{ ["--reveal-delay" as string]: `${150 + i * 80}ms` }}
              className="group relative flex items-center gap-4 border-b border-border py-5 first:pt-3 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="kicker text-[0.7rem]">{categoryFor(post).label}</p>
                <h3 className="headline mt-1.5 text-[1.1rem] leading-snug">
                  <Link href={postPath(post.slug)} className="after:absolute after:inset-0 after:content-['']">
                    <span className="title-link">{post.title}</span>
                  </Link>
                </h3>
                {ago && post.publishedAt && (
                  <time dateTime={post.publishedAt} className="mt-1.5 block text-sm text-muted-foreground">
                    {ago}
                  </time>
                )}
              </div>
              <ArrowRight className="arrow h-5 w-5 flex-none text-primary" aria-hidden="true" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
