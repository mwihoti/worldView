import Link from "next/link";
import { CATEGORIES, SECTION_ORDER, sectionHref } from "@/lib/category";
import { getPublication } from "@/lib/requests";

/* Navy band to close the page, mirroring the masthead. */
export default async function Footer() {
  const publication = await getPublication();
  const title = publication.displayTitle || publication.title;

  return (
    <footer className="masthead mt-8">
      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link href="/" className="wordmark text-[2.2rem]">
            WorldView
          </Link>
          <p className="mt-4 max-w-sm text-[0.95rem] leading-relaxed text-masthead-foreground/75">
            News, sport, screen and technology stories from around the world, written by a small
            team with opinions.
          </p>
        </div>

        <nav aria-label="Footer sections">
          <h2 className="kicker !text-masthead-accent">Sections</h2>
          <ul className="mt-4 space-y-2.5">
            {SECTION_ORDER.map((id) => (
              <li key={id}>
                <Link href={sectionHref(CATEGORIES[id])} className="masthead-link !text-base">
                  {CATEGORIES[id].label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="More">
          <h2 className="kicker !text-masthead-accent">More</h2>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link href="/posts" className="masthead-link !text-base">
                All stories
              </Link>
            </li>
            <li>
              <Link href="/feed.xml" className="masthead-link !text-base">
                RSS feed
              </Link>
            </li>
            <li>
              <Link
                href="https://github.com/mwihoti/worldView"
                target="_blank"
                rel="noreferrer"
                className="masthead-link !text-base"
              >
                Source code
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="wrap py-5 text-sm text-masthead-foreground/65">
          &copy; {new Date().getFullYear()} {title}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
