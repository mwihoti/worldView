import FeaturedPost from "@/components/featured-post";
import Hero from "@/components/hero";
import Marquee from "@/components/marquee";
import PostList from "@/components/post-list";
import SectionHeading from "@/components/section-heading";
import { getPosts } from "@/lib/requests";

export const revalidate = 300;

export default async function Home() {
  const page = await getPosts({ first: 12 });
  const [newest, ...rest] = page.edges;

  return (
    <main id="main">
      <Hero />
      <Marquee />

      <div id="latest" className="wrap scroll-mt-24 pt-16 sm:pt-20">
        <SectionHeading eyebrow="fresh off the desk" title="The latest" />

        {newest && (
          <div className="mt-8">
            <FeaturedPost post={newest.node} />
          </div>
        )}

        <div className="mt-14">
          <PostList
            initialPage={{ ...page, edges: rest }}
            showEmpty={!newest}
          />
        </div>
      </div>
    </main>
  );
}
