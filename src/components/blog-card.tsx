import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Avatar from "./avatar";
import CategoryTag from "./category-tag";
import PostCover from "./post-cover";
import { categoryFor } from "@/lib/category";
import { postPath } from "@/lib/post-url";
import type { PostNode } from "@/lib/types";

type Props = {
  post: PostNode;
  index?: number;
  /* Heading level for the title: 3 under a section heading, 2 directly under a page title. */
  level?: 2 | 3;
};

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export default function BlogCard({ post, index = 0, level = 3 }: Props) {
  const Heading = level === 2 ? "h2" : "h3";
  const category = categoryFor(post);
  const tilt = index % 3 === 0 ? "-0.5deg" : index % 3 === 1 ? "0.4deg" : "-0.3deg";

  return (
    // The wrapper takes the scroll reveal; the card inside takes the hover
    // lift, so the two transforms never fight over the same element.
    <div
      data-reveal
      style={{ ["--reveal-delay" as string]: `${(index % 3) * 110}ms` }}
    >
      <article
        data-cat={category.id}
        className="sticker sticker-hover group relative flex h-full flex-col overflow-hidden"
        style={{ ["--tilt" as string]: tilt, ["--hover-tilt" as string]: "0.6deg" }}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden border-b-2 border-ink">
          <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.06] group-hover:-rotate-1">
            <PostCover
              post={post}
              sizes="(max-width: 768px) 100vw, (max-width: 1100px) 50vw, 400px"
            />
          </div>
          <CategoryTag category={category} className="absolute left-3 top-3 shadow-[2px_2px_0_hsl(var(--stick))]" />
        </div>

        <div className="flex flex-1 flex-col p-5">
          <Heading className="font-display text-[1.4rem] font-bold leading-[1.18] tracking-tight">
            <Link
              href={postPath(post.slug)}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-offset-8"
            >
              <span className="bg-[linear-gradient(hsl(var(--marker)/var(--marker-alpha)),hsl(var(--marker)/var(--marker-alpha)))] bg-[length:0%_38%] bg-left-bottom bg-no-repeat transition-[background-size] duration-500 group-hover:bg-[length:100%_38%]">
                {post.title}
              </span>
            </Link>
          </Heading>

          <p className="mt-3 line-clamp-3 text-[0.95rem] leading-relaxed text-muted-foreground">
            {post.subtitle || post.brief}
          </p>

          <div className="mt-auto flex items-center gap-2.5 pt-5 text-sm">
            <Avatar name={post.author.name} src={post.author.profilePicture} size={30} />
            <span className="font-semibold">{post.author.name}</span>
            {post.publishedAt && (
              <time dateTime={post.publishedAt} className="text-muted-foreground">
                · {dateFormat.format(new Date(post.publishedAt))}
              </time>
            )}
            <ArrowUpRight
              className="ml-auto h-5 w-5 -translate-x-1 translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
              aria-hidden="true"
            />
          </div>
        </div>
      </article>
    </div>
  );
}
