'use client'
import Posts from "@/components/posts";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { getPosts } from "@/lib/requests";
import {  useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";

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
  const router = useRouter();
  

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
      <div className="mb-4">
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="text-lg" />
        <span className="text-sm font-medium">Back</span>
      </button>
        
        </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      
        <HydrationBoundary state={dehydrate(queryClient)}>
        
          <Posts />

       
        </HydrationBoundary>

        
      </div>
    </main>
  );
}