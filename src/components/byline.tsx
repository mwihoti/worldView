import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PostNode } from "@/lib/types";

/* "By Sofia Ramirez | May 20, 2024" */
export default function Byline({
  post,
  className,
  children,
}: {
  post: Pick<PostNode, "author" | "publishedAt">;
  className?: string;
  children?: React.ReactNode;
}) {
  const date = formatDate(post.publishedAt);
  return (
    <p className={cn("byline", className)}>
      <span>
        By <span className="font-medium text-foreground">{post.author.name}</span>
      </span>
      {date && post.publishedAt && <time dateTime={post.publishedAt}>{date}</time>}
      {children}
    </p>
  );
}
