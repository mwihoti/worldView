"use client";

import { getPostBySlug } from "@/lib/requests";
import { useQuery } from "@tanstack/react-query";
import { notFound, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faArrowUp, faThumbsUp, faCommentDots } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";

type Props = {
  slug: string;
};

export default function Post({ slug }: Props) {
  const { data } = useQuery({
    queryKey: ["post", slug],
    queryFn: () => getPostBySlug(slug),
  });
  const router = useRouter();
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState<string[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 100) {
        setShowScrollUp(true);
      } else {
        setShowScrollUp(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLike = () => {
    setLikes((prev) => prev + 1);
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      setComments((prev) => [...prev, newComment]);
      setNewComment("");
    }
  };

  if (!data) return notFound();

  return (
    <div>
      {/* Back Button */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 mb-4 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="text-lg" />
        <span className="text-sm font-medium">Back</span>
      </button>

      {/* Post Cover Image */}
      {data?.coverImage && (
        <img src={data?.coverImage.url} alt="Post cover" className="w-full" />
      )}

      {/* Post Title */}
      <h1 className="text-4xl lg:text-6xl text-center leading-relaxed font-bold mt-5">
        {data?.title}
      </h1>

      {/* Post Subtitle */}
      <p className="my-5 text-center text-xl text-gray-400">{data?.subtitle}</p>

      {/* Post Author */}
      <div className="my-5 flex items-center justify-center text-lg">
        {data?.author.profilePicture && (
          <img
            src={data?.author.profilePicture}
            alt={data?.author.name}
            className="rounded-full h-10 w-10 mr-5"
          />
        )}
        {data?.author.name}
      </div>

      {/* Post Content */}
      <div
        className="blog-content text-xl leading-loose flex flex-col gap-5 mt-5"
        dangerouslySetInnerHTML={{ __html: data!.content.html }}
      ></div>

      {/* Likes and Comments Section */}
      <div className="mt-10 border-t pt-5">
        {/* Likes Section */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition"
          >
            <FontAwesomeIcon icon={faThumbsUp} />
            <span>{likes} {likes === 1 ? "Like" : "Likes"}</span>
          </button>
        </div>

        {/* Comments Section */}
        <div className="mt-8">
          <h3 className="text-2xl font-bold mb-4">Comments</h3>
          {/* Add New Comment */}
          <div className="flex gap-3 mb-5">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <button
              onClick={handleAddComment}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition"
            >
              Comment
            </button>
          </div>

          {/* Display Comments */}
          <ul className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-gray-500">No comments yet. Be the first to comment!</p>
            ) : (
              comments.map((comment, index) => (
                <li key={index} className="bg-gray-100 p-4 rounded-lg shadow">
                  {comment}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {/* Scroll Up Button */}
      {showScrollUp && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 p-3 bg-indigo-600 text-white rounded-full shadow-md hover:bg-indigo-700 transition"
        >
          <FontAwesomeIcon icon={faArrowUp} className="text-lg" />
        </button>
      )}
    </div>
  );
}
