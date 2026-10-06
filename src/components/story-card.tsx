import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PostCover from "./post-cover";
import { categoryFor } from "@/lib/category";
import { formatDate } from "@/lib/dates";
import { postPath } from "@/lib/post-url";
import type { PostNode } from "@/lib/types";

type Props = {
  post: PostNode;
  index?: number;
  /* Heading level for the title: 3 under a section title, 2 directly under a page title. */
  level?: 2 | 3;
};

/* Picture on top, then section, headline, standfirst and byline. */
export default function StoryCard({ post, index = 0, level = 3 }: Props) {
  const Heading = level === 2 ? "h2" : "h3";
  const category = categoryFor(post);
  const date = formatDate(post.publishedAt);

  return (
    <div data-reveal style={{ ["--reveal-delay" as string]: `${(index % 3) * 90}ms` }} className="h-full">
      <article className="story-card group">
        <div className="relative aspect-[16/7] w-full overflow-hidden bg-muted">
          <div className="cover-zoom absolute inset-0">
            <PostCover post={post} sizes="(max-width: 768px) 100vw, (max-width: 1100px) 50vw, 480px" />
          </div>
        </div>

        <div className="flex flex-1 flex-col px-6 pb-6 pt-5">
          <p className="kicker">{category.label}</p>
          <Heading className="headline mt-2.5 text-[1.45rem] leading-[1.22]">
            <Link
              href={postPath(post.slug)}
              className="after:absolute after:inset-0 after:content-['']"
            >
              <span className="title-link">{post.title}</span>
            </Link>
          </Heading>
          {(post.subtitle || post.brief) && (
            <p className="mt-2.5 line-clamp-2 text-[0.95rem] leading-relaxed text-muted-foreground">
              {post.subtitle || post.brief}
            </p>
          )}
          <div className="mt-auto flex items-center gap-3 pt-5">
            <p className="byline">
              <span className="font-medium text-foreground">By {post.author.name}</span>
              {date && post.publishedAt && <time dateTime={post.publishedAt}>{date}</time>}
            </p>
            <ArrowRight className="arrow ml-auto h-5 w-5 flex-none text-primary" aria-hidden="true" />
          </div>
        </div>
      </article>
    </div>
  );
}
