import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PostList from "@/components/post-list";
import { Button } from "@/components/ui/button";
import { getPosts, getPostsByAuthor } from "@/lib/requests";

export const revalidate = 300;

type Props = {
  searchParams: Promise<{ author?: string }>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { author } = await searchParams;
  return {
    title: author ? `Posts by ${author}` : "All posts",
  };
}

export default async function PostsPage({ searchParams }: Props) {
  const { author } = await searchParams;
  const initialPage = author
    ? await getPostsByAuthor(author)
    : await getPosts({ first: 12 });

  return (
    <main className="max-w-7xl w-full px-3 xl:px-0 mx-auto mt-5">
      <div className="mb-4 flex items-center gap-4">
        <Button asChild variant="outline">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">
          {author ? `Posts by ${author}` : "All posts"}
        </h1>
      </div>
      <PostList initialPage={initialPage} />
    </main>
  );
}
