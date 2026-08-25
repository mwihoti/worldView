import Image from "next/image";
import Link from "next/link";
import { PostNode } from "@/lib/types";
import { Card, CardContent, CardHeader } from "./ui/card";

type Props = {
  post: PostNode;
};

export default function BlogCard({ post }: Props) {
  return (
    <Card className="flex flex-col overflow-hidden">
      {post.coverImage && (
        <CardHeader className="p-0">
          <Link
            href={`/${post.slug}`}
            className="relative block aspect-video w-full"
          >
            <Image
              src={post.coverImage.url}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
            />
          </Link>
        </CardHeader>
      )}
      <CardContent className="pt-6">
        <h2 className="text-xl font-bold">
          <Link href={`/${post.slug}`} className="hover:underline">
            {post.title}
          </Link>
        </h2>
        <div className="mt-3 flex gap-3 items-center text-sm">
          {post.author.profilePicture && (
            <Image
              src={post.author.profilePicture}
              alt={post.author.name}
              width={28}
              height={28}
              className="h-7 w-7 rounded-full"
            />
          )}
          <span>{post.author.name}</span>
          {post.publishedAt && (
            <time dateTime={post.publishedAt} className="text-muted-foreground">
              {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                new Date(post.publishedAt)
              )}
            </time>
          )}
        </div>
        <p className="text-muted-foreground line-clamp-4 mt-3">
          {post.subtitle || post.brief}
        </p>
      </CardContent>
    </Card>
  );
}
