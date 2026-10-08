import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Avatar from "./avatar";
import CategoryTag from "./category-tag";
import PostCover from "./post-cover";
import { categoryFor } from "@/lib/category";
import { postPath } from "@/lib/post-url";
import type { PostNode } from "@/lib/types";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long" });

/* The newest story, given the whole row: picture taped on one side, words on the other. */
export default function FeaturedPost({ post }: { post: PostNode }) {
  const category = categoryFor(post);

  return (
    <article
      data-reveal
      data-cat={category.id}
      className="sticker group relative grid gap-0 overflow-visible lg:grid-cols-[1.15fr_1fr]"
    >
      <div className="relative p-3 sm:p-5">
        {/* Tape sits on an outer wrapper: the picture's own overflow:hidden would clip it. */}
        <div className="tape relative -rotate-1 transition-transform duration-500 group-hover:rotate-0">
          <div className="relative aspect-[16/11] w-full overflow-hidden rounded-lg border-2 border-ink bg-muted">
            <PostCover
              post={post}
              priority
              sizes="(max-width: 1024px) 100vw, 560px"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center p-6 sm:p-8 lg:pl-4">
        <div className="flex items-center gap-3">
          <CategoryTag category={category} />
          <span className="font-hand text-2xl leading-none text-primary">newest</span>
        </div>

        <h3 className="font-display mt-4 text-3xl font-bold leading-[1.08] tracking-tight sm:text-4xl xl:text-[2.75rem]">
          <Link
            href={postPath(post.slug)}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {post.title}
          </Link>
        </h3>

        <p className="mt-4 line-clamp-4 text-lg leading-relaxed text-muted-foreground">
          {post.subtitle || post.brief}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          <Avatar name={post.author.name} src={post.author.profilePicture} size={36} />
          <span className="font-semibold">{post.author.name}</span>
          {post.publishedAt && (
            <time dateTime={post.publishedAt} className="text-muted-foreground">
              · {dateFormat.format(new Date(post.publishedAt))}
            </time>
          )}
        </div>

        <span className="mt-6 inline-flex items-center gap-2 font-bold text-primary">
          Read the story
          <ArrowRight
            className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-2"
            aria-hidden="true"
          />
        </span>
      </div>
    </article>
  );
}
