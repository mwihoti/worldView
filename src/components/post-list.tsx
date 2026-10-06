"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import StoryCard from "./story-card";
import { loadMorePosts } from "@/lib/actions";
import { PostsPage } from "@/lib/types";

type Props = {
  initialPage: PostsPage;
  /* Heading level of the card titles (see StoryCard). */
  cardLevel?: 2 | 3;
  emptyMessage?: string;
};

export default function PostList({ initialPage, cardLevel = 3, emptyMessage = "No stories here yet." }: Props) {
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
    return <p className="py-20 text-center text-lg text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div>
      <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
        {edges.map((edge, i) => (
          <StoryCard key={edge.node.id} post={edge.node} index={i} level={cardLevel} />
        ))}
      </div>

      {pageInfo.hasNextPage && (
        <div className="mt-12 flex justify-center">
          <button type="button" className="btn-outline" disabled={isPending} onClick={handleLoadMore}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading&hellip;
              </>
            ) : (
              "Load more stories"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
