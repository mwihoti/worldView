"use client";

import { getPosts } from "@/lib/requests";
import { useInfiniteQuery } from "@tanstack/react-query";
import BlogCard from "./blog-card";
import { Button } from "./ui/button";
import { PostNode } from "@/lib/types";

export default function Posts({ author }: { author?: string }) {
  const { data, hasNextPage, fetchNextPage, isFetching } = useInfiniteQuery({
    queryKey: ["posts", author],
    queryFn: getPosts,
    getNextPageParam: (lastPage) =>
      lastPage.length < 8 ? undefined : lastPage[lastPage.length - 1].cursor,
    initialPageParam: "",
  });

  // Filter posts by author client-side
  const filteredPosts = data?.pages.flatMap((group) => 
    group.filter((post) => 
      !author || post.node.author.name.toLowerCase() === author.toLowerCase()
    )
  );

  if (!filteredPosts?.length) {
    return (
      <div className="col-span-full text-center text-xl">
        {author 
          ? `No posts found for author ${author}` 
          : "No posts available"}
      </div>
    );
  }

  return (
    <>
      {filteredPosts.map((post) => (
        <BlogCard key={post.node.id} post={post.node} />
      ))}
      <div className="col-span-1 lg:col-span-3 w-full flex justify-center my-5">
        <Button
          className="w-full"
          variant="outline"
          disabled={!hasNextPage || isFetching}
          onClick={() => fetchNextPage()}
        >
          {isFetching
            ? "Loading..."
            : hasNextPage
            ? "Load more"
            : "That's all for today!"}
        </Button>
      </div>
    </>
  );
}