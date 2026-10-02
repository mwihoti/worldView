import Image from "next/image";
import { categoryFor } from "@/lib/category";
import { coverSvg } from "@/lib/cover-art";
import type { PostNode } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * Fills its (relatively positioned) parent with the post's cover: the real
 * image when there is one, otherwise a generated illustration so no post
 * ever shows an empty box.
 */
export default function PostCover({
  post,
  sizes,
  priority = false,
  className,
}: {
  post: Pick<PostNode, "title" | "slug" | "coverImage" | "author">;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (post.coverImage?.url) {
    return (
      <Image
        src={post.coverImage.url}
        alt=""
        fill
        priority={priority}
        sizes={sizes}
        className={cn("object-cover", className)}
      />
    );
  }
  const category = categoryFor(post).id;
  return (
    <div
      className={cn("cover-art absolute inset-0", className)}
      dangerouslySetInnerHTML={{
        __html: coverSvg({ seed: post.slug, category }),
      }}
    />
  );
}
