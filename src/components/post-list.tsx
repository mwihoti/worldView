"use client";

import { useState, useTransition } from "react";
import BlogCard from "./blog-card";
import { Button } from "./ui/button";
import { loadMorePosts } from "@/lib/actions";
import { PostsPage } from "@/lib/types";

type Props = {
  initialPage: PostsPage;
};

export default function PostList({ initialPage }: Props) {
  const [edges, setEdges] = useState(initialPage.edges);
  const [pageInfo, setPageInfo] = useState(initialPage.pageInfo);
  const [isPending, startTransition] = useTransition();

  function handleLoadMore() {
    if (!pageInfo.endCursor) return;
    const after = pageInfo.endCursor;

    startTransition(async () => {
      const nextPage = await loadMorePosts(after);
      setEdges((prev) => [...prev, ...nextPage.edges]);
      setPageInfo(nextPage.pageInfo);
    });
  }

  if (edges.length === 0) {
    return (
      <p className="text-center text-muted-foreground my-20">
        No posts found.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {edges.map((edge) => (
        <BlogCard key={edge.node.id} post={edge.node} />
      ))}
      <div className="col-span-full w-full flex justify-center my-5">
        <Button
          className="w-full"
          variant="outline"
          disabled={!pageInfo.hasNextPage || isPending}
          onClick={handleLoadMore}
        >
          {isPending
            ? "Loading..."
            : pageInfo.hasNextPage
            ? "Load more"
            : "That's all for today!"}
        </Button>
      </div>
    </div>
  );
}
