import type { Metadata } from "next";
import Link from "next/link";
import PostList from "@/components/post-list";
import { CATEGORIES, SECTION_ORDER, categoryBySlug, sectionHref, type Category } from "@/lib/category";
import { getPosts, getPostsByAuthor, getPostsBySection, searchPosts } from "@/lib/requests";

export const revalidate = 300;

type Props = {
  searchParams: Promise<{ section?: string; author?: string; q?: string }>;
};

/* Old links used ?author=Dennis for a section; map those onto sections. */
function sectionFromAuthor(author?: string): Category | undefined {
  return SECTION_ORDER.map((id) => CATEGORIES[id]).find(
    (c) => c.author && c.author.toLowerCase() === author?.toLowerCase()
  );
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { section, author, q } = await searchParams;
  const category = categoryBySlug(section) ?? sectionFromAuthor(author);
  if (q?.trim()) return { title: `Search: ${q.trim()}`, robots: { index: false } };
  return {
    title: category ? category.label : author ? `Stories by ${author}` : "All stories",
    description: category?.blurb,
  };
}

export default async function PostsPage({ searchParams }: Props) {
  const { section, author, q } = await searchParams;
  const query = q?.trim() ?? "";
  const category = query ? undefined : categoryBySlug(section) ?? sectionFromAuthor(author);

  const page = query
    ? await searchPosts(query)
    : category
      ? await getPostsBySection(category.id)
      : author
        ? await getPostsByAuthor(author)
        : await getPosts({ first: 12 });

  const title = query
    ? `Results for “${query}”`
    : category
      ? category.label
      : author
        ? `Stories by ${author}`
        : "All stories";
  const blurb = query
    ? `${page.edges.length} ${page.edges.length === 1 ? "story" : "stories"} found.`
    : (category?.blurb ?? "Every story, newest first.");

  const tabs = [
    { label: "All", href: "/posts", current: !query && !category && !author },
    ...SECTION_ORDER.map((id) => ({
      label: CATEGORIES[id].label,
      href: sectionHref(CATEGORIES[id]),
      current: category?.id === id,
    })),
  ];

  return (
    <main id="main" className="wrap pb-20 pt-10 lg:pt-14">
      <header data-enter>
        {category && <p className="kicker">Section</p>}
        <h1 className="headline mt-2 text-4xl sm:text-5xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{blurb}</p>
      </header>

      <nav aria-label="Sections" className="mt-8 flex gap-7 overflow-x-auto border-b border-border">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} aria-current={tab.current ? "page" : undefined} className="tab whitespace-nowrap">
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mt-10">
        <PostList
          key={`${section ?? ""}|${author ?? ""}|${query}`}
          initialPage={page}
          cardLevel={2}
          emptyMessage={query ? "Nothing matched. Try fewer or different words." : "No stories here yet."}
        />
      </div>
    </main>
  );
}
