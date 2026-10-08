"use client";

import { useState, useTransition } from "react";
import { ArrowDown, Loader2, PartyPopper } from "lucide-react";
import BlogCard from "./blog-card";
import { loadMorePosts } from "@/lib/actions";
import { PostsPage } from "@/lib/types";

type Props = {
  initialPage: PostsPage;
  /* Set false when something else on the page (a featured story) already
   * accounts for the posts, so an empty list isn't reported as "no posts". */
  showEmpty?: boolean;
  /* Heading level of the card titles (see BlogCard). */
  cardLevel?: 2 | 3;
};

export default function PostList({ initialPage, showEmpty = true, cardLevel = 3 }: Props) {
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
    if (!showEmpty) return null;
    return (
      <p className="font-hand my-20 text-center text-3xl text-muted-foreground">
        Nothing here yet &mdash; check back soon.
      </p>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-x-7 gap-y-9 md:grid-cols-2 lg:grid-cols-3">
        {edges.map((edge, i) => (
          <BlogCard key={edge.node.id} post={edge.node} index={i} level={cardLevel} />
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        {pageInfo.hasNextPage ? (
          <button
            type="button"
            className="btn-ink"
            disabled={isPending}
            onClick={handleLoadMore}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Fetching&hellip;
              </>
            ) : (
              <>
                Load more stories <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        ) : (
          <p className="font-hand inline-flex items-center gap-2 text-3xl text-muted-foreground">
            <PartyPopper className="h-6 w-6 text-primary" aria-hidden="true" />
            That&apos;s all for today!
          </p>
        )}
      </div>
    </div>
  );
}
