import FeaturedStory from "@/components/featured-story";
import HeadlineList from "@/components/headline-list";
import SectionHeader from "@/components/section-header";
import StoryCard from "@/components/story-card";
import { CATEGORIES, SECTION_ORDER, categoryFor, sectionHref } from "@/lib/category";
import { getPosts } from "@/lib/requests";

export const revalidate = 300;

/*
 * Front page: the newest story leads, the next three run as headlines down
 * the side, then three more as "Latest stories", then a row for each
 * section with stories not already shown above.
 */
export default async function Home() {
  const { edges } = await getPosts({ first: 12 });
  const posts = edges.map((edge) => edge.node);
  const [lead, ...rest] = posts;
  const headlines = rest.slice(0, 3);
  const latest = rest.slice(3, 6);

  const shown = new Set([lead, ...headlines, ...latest].filter(Boolean).map((p) => p.id));
  const sections = SECTION_ORDER.map((id) => ({
    category: CATEGORIES[id],
    posts: posts.filter((p) => !shown.has(p.id) && categoryFor(p).id === id).slice(0, 3),
  })).filter((s) => s.posts.length > 0);

  if (!lead) {
    return (
      <main id="main" className="wrap py-24 text-center">
        <h1 className="headline text-4xl">No stories yet</h1>
        <p className="mt-3 text-muted-foreground">Check back soon.</p>
      </main>
    );
  }

  return (
    <main id="main" className="wrap pb-20 pt-10 lg:pt-12">
      <h1 className="sr-only">WorldView: the latest stories</h1>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:gap-0">
        <div className="lg:pr-12">
          <FeaturedStory post={lead} />
        </div>
        <aside className="lg:border-l lg:border-border lg:pl-8">
          <HeadlineList posts={headlines} />
        </aside>
      </div>

      {latest.length > 0 && (
        <section aria-labelledby="latest-title" className="mt-14 lg:mt-12">
          <SectionHeader id="latest-title" title="Latest stories" href="/posts" linkLabel="View all stories" />
          <div className="mt-6 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
            {latest.map((post, i) => (
              <StoryCard key={post.id} post={post} index={i} />
            ))}
          </div>
        </section>
      )}

      {sections.map(({ category, posts: sectionPosts }) => (
        <section key={category.id} aria-labelledby={`section-${category.slug}`} className="mt-16">
          <SectionHeader
            id={`section-${category.slug}`}
            title={category.label}
            href={sectionHref(category)}
            linkLabel={`More ${category.label}`}
          />
          <div className="mt-6 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
            {sectionPosts.map((post, i) => (
              <StoryCard key={post.id} post={post} index={i} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
