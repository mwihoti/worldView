"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ThumbsUp } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export default function PostInteractions() {
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState<string[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollUp(
        window.innerHeight + window.scrollY >= document.body.scrollHeight - 100
      );
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function handleAddComment() {
    if (newComment.trim()) {
      setComments((prev) => [...prev, newComment.trim()]);
      setNewComment("");
    }
  }

  return (
    <div className="mt-10 border-t pt-5">
      <Button
        onClick={() => setLikes((prev) => prev + 1)}
        className="flex items-center gap-2"
      >
        <ThumbsUp className="h-4 w-4" />
        <span>
          {likes} {likes === 1 ? "Like" : "Likes"}
        </span>
      </Button>

      <div className="mt-8">
        <h3 className="text-2xl font-bold mb-4">Comments</h3>
        <div className="flex gap-3 mb-5">
          <Input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
            placeholder="Add a comment..."
          />
          <Button onClick={handleAddComment}>Comment</Button>
        </div>

        <ul className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-muted-foreground">
              No comments yet. Be the first to comment!
            </p>
          ) : (
            comments.map((comment, index) => (
              <li key={index} className="bg-muted p-4 rounded-lg">
                {comment}
              </li>
            ))
          )}
        </ul>
      </div>

      {showScrollUp && (
        <Button
          size="icon"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-8 right-8 rounded-full shadow-md"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
