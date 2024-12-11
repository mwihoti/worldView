"use client";

import { useSearchParams } from "next/navigation"; // Import useSearchParams
import { useInfiniteQuery } from "@tanstack/react-query";
import BlogCard from "./blog-card";
import { Button } from "./ui/button";
import { getPosts } from "@/lib/requests";

export default function Posts() {
  const searchParams = useSearchParams(); // Get the search parameters
  const author = searchParams.get("author"); // Extract the 'author' query parameter

  const { data, hasNextPage, fetchNextPage, isFetching } = useInfiniteQuery({
    queryKey: ["posts"],
    queryFn: ({ pageParam = "" }) => getPosts(pageParam),
    getNextPageParam: (lastPage) =>
      lastPage.length < 12 ? undefined : lastPage[lastPage.length - 1].cursor,
    initialPageParam: "",
  });

  console.log("posts data", data);

  const filteredPosts = data?.pages
    .flat()
    .filter((post) =>
      author
        ? post.node.author.name.toLowerCase().includes(author.toLowerCase())
        : true
    );

  return (
    <>
      {filteredPosts?.map((post) => (
        <BlogCard key={post.cursor} post={post.node} />
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
