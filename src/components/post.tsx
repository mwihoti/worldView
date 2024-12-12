"use client";

import { getPostBySlug } from "@/lib/requests";
import { useQuery } from "@tanstack/react-query";
import { notFound, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faArrowUp } from "@fortawesome/free-solid-svg-icons";
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

  useEffect(() => {
    const handleScroll = () => {
      if ( window.innerHeight + window.scrollY >= document.body.scrollHeight - 100) {
        setShowScrollUp(true);
      } else {
        setShowScrollUp(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);

  }, [] );

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

 if (!data) return notFound()
  return (
    <div>
        <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 mb-4 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="text-lg" />
        <span className="text-sm font-medium">Back</span>
      </button>
      {data?.coverImage && (
        
        <img src={data?.coverImage.url } alt="loadng post " className="w-full" />
      )}
      
      <h1 className="text-4xl lg:text-6xl text-center leading-relaxed font-bold mt-5">
        {data?.title}
      </h1>
      <p className="my-5 text-center text-xl text-gray-400">{data?.subtitle}</p>
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
      <div
        className="blog-content text-xl leading-loose flex flex-col gap-5 mt-5"
        dangerouslySetInnerHTML={{ __html: data!.content.html }}
      >
       
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
