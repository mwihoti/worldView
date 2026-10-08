import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PostList from "@/components/post-list";
import SectionHeading from "@/components/section-heading";
import { CATEGORIES, type CategoryId } from "@/lib/category";
import { getPosts, getPostsByAuthor } from "@/lib/requests";
import { cn } from "@/lib/utils";

export const revalidate = 300;

type Props = {
  searchParams: Promise<{ author?: string }>;
};

const FILTERS: CategoryId[] = ["sports", "screen", "tech"];

function sectionFor(author?: string) {
  return FILTERS.map((id) => CATEGORIES[id]).find(
    (c) => c.author?.toLowerCase() === author?.toLowerCase()
  );
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { author } = await searchParams;
  const section = sectionFor(author);
  return {
    title: section ? section.label : author ? `Posts by ${author}` : "All posts",
  };
}

export default async function PostsPage({ searchParams }: Props) {
  const { author } = await searchParams;
  const section = sectionFor(author);
  const initialPage = author
    ? await getPostsByAuthor(author)
    : await getPosts({ first: 12 });

  const heading = section ? section.label : author ? `Posts by ${author}` : "Everything";
  const blurb = section?.blurb ?? "Every story, newest first.";

  return (
    <main id="main" className="wrap pb-4 pt-6 sm:pt-10">
      <Link
        href="/"
        className="nav-link mb-6"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Home
      </Link>

      <SectionHeading eyebrow={blurb} title={heading} as="h1" />

      <ul className="mt-6 flex flex-wrap gap-3" aria-label="Filter by section">
        {[{ id: null, label: "All", href: "/posts" }, ...FILTERS.map((id) => ({
          id,
          label: CATEGORIES[id].label,
          href: `/posts?author=${CATEGORIES[id].author}`,
        }))].map((chip) => {
          const active = (chip.id === null && !author) || section?.id === chip.id;
          return (
            <li key={chip.label} data-cat={chip.id ?? undefined}>
              <Link
                href={chip.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border-2 border-ink px-4 py-1.5 font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-card hover:bg-accent"
                )}
              >
                {chip.id && <span className="cat-dot" aria-hidden="true" />}
                {chip.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-10">
        <PostList initialPage={initialPage} cardLevel={2} />
      </div>
    </main>
  );
}
