"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Heart, MessageCircle, Send } from "lucide-react";

const BURST_COLORS = [
  "var(--primary)",
  "var(--c-story)",
  "var(--c-screen)",
  "var(--c-tech)",
  "var(--marker)",
];

/*
 * Applause + notes at the end of an article. As before, both are local to
 * this visit (nothing is stored), so they behave like a fun little guestbook
 * rather than a real discussion.
 */
export default function PostInteractions() {
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [likes, setLikes] = useState(0);
  const [bursts, setBursts] = useState<number[]>([]);
  const [comments, setComments] = useState<string[]>([]);
  const [newComment, setNewComment] = useState("");
  const burstId = useRef(0);

  useEffect(() => {
    const handleScroll = () => setShowScrollUp(window.scrollY > 700);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function applaud() {
    setLikes((prev) => prev + 1);
    const id = ++burstId.current;
    setBursts((prev) => [...prev, id]);
    window.setTimeout(() => setBursts((prev) => prev.filter((b) => b !== id)), 800);
  }

  function handleAddComment() {
    if (newComment.trim()) {
      setComments((prev) => [newComment.trim(), ...prev]);
      setNewComment("");
    }
  }

  return (
    <section aria-label="Reactions and notes" className="mx-auto mt-16 max-w-2xl">
      <div data-reveal className="flex flex-col items-center gap-3 text-center">
        <p className="font-hand text-3xl text-primary">enjoyed that?</p>
        <button
          type="button"
          onClick={applaud}
          className="btn-ink relative !px-6 !py-3 text-lg"
          aria-label={`Applaud this story. ${likes} so far.`}
        >
          <Heart
            className={`h-5 w-5 ${likes ? "fill-current" : ""}`}
            aria-hidden="true"
          />
          <span aria-hidden="true">
            {likes === 0 ? "Say thanks" : `${likes}× thanks`}
          </span>
          {bursts.map((id) => (
            <span key={id} aria-hidden="true" className="pointer-events-none absolute inset-0">
              {Array.from({ length: 8 }).map((_, i) => {
                const angle = (i / 8) * Math.PI * 2;
                return (
                  <span
                    key={i}
                    className="burst-bit"
                    style={{
                      ["--bx" as string]: `${Math.cos(angle) * 56}px`,
                      ["--by" as string]: `${Math.sin(angle) * 56}px`,
                      ["--c" as string]: BURST_COLORS[i % BURST_COLORS.length],
                    }}
                  />
                );
              })}
            </span>
          ))}
        </button>
      </div>

      <div data-reveal className="sticker mt-12 p-5 sm:p-7">
        <h3 className="font-display flex items-center gap-2.5 text-2xl font-bold">
          <MessageCircle className="h-6 w-6 text-primary" aria-hidden="true" />
          Notes in the margin
        </h3>

        <div className="mt-4 flex gap-3">
          <label htmlFor="note" className="sr-only">
            Leave a note
          </label>
          <input
            id="note"
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
            placeholder="Scribble something…"
            className="font-hand min-w-0 flex-1 rounded-lg border-2 border-ink bg-background px-4 py-2 text-xl placeholder:text-muted-foreground"
          />
          <button type="button" onClick={handleAddComment} className="btn-ink" aria-label="Post note">
            <Send className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Post</span>
          </button>
        </div>

        <ul className="mt-5 space-y-3">
          {comments.length === 0 ? (
            <li className="font-hand text-2xl text-muted-foreground">
              No notes yet. Be the first to scribble one!
            </li>
          ) : (
            comments.map((comment, index) => (
              <li
                key={`${comment}-${index}`}
                className="animate-in fade-in-0 slide-in-from-top-2 rounded-lg border-2 border-dashed border-ink bg-secondary px-4 py-3 text-lg duration-300"
                style={{ rotate: index % 2 ? "0.4deg" : "-0.4deg" }}
              >
                {comment}
              </li>
            ))
          )}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to the top"
        tabIndex={showScrollUp ? 0 : -1}
        className={`btn-ink fixed bottom-6 right-6 z-40 !h-12 !w-12 !justify-center !p-0 transition-all duration-300 ${
          showScrollUp
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0"
        }`}
      >
        <ArrowUp className="h-5 w-5" aria-hidden="true" />
      </button>
    </section>
  );
}
