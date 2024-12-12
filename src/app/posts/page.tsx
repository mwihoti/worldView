import Posts from "@/components/posts";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { getPosts } from "@/lib/requests";

type Post = {
  cursor: string;
  // other post properties
};

export default async function PostsPage({
  searchParams,
}: {
  searchParams: { author?: string };
}) {
  const queryClient = new QueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["posts", searchParams.author],
    queryFn: () => getPosts({ author: searchParams.author }),
    getNextPageParam: (lastPage: Post[] ) =>
      lastPage.length < 8 ? undefined : lastPage[lastPage.length - 1].cursor,
    initialPageParam: "",
  });

  return (
    <main className="max-w-7xl w-full px-3 xl:p-0 mx-auto">
      {searchParams.author && (
        <h1 className="text-2xl font-bold mb-5">
          Posts by {searchParams.author}
        </h1>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Posts />
        </HydrationBoundary>
      </div>
    </main>
  );
}