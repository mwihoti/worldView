import Link from "next/link";
import { Coffee, Clapperboard, Laptop, Rss, Trophy } from "lucide-react";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { LogoMark } from "./logo";
import { CATEGORIES, type CategoryId } from "@/lib/category";
import { getPublication } from "@/lib/requests";

const SECTIONS: { id: CategoryId; icon: typeof Trophy }[] = [
  { id: "sports", icon: Trophy },
  { id: "screen", icon: Clapperboard },
  { id: "tech", icon: Laptop },
];

export default async function Footer() {
  const publication = await getPublication();
  const title = publication.displayTitle || publication.title;

  return (
    <footer className="relative mt-24 border-t-2 border-ink bg-card">
      {/* torn-paper edge */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 24"
        preserveAspectRatio="none"
        className="absolute inset-x-0 -top-[1.45rem] h-6 w-full text-card"
      >
        <path
          d="M0 24V10l30 8 40-10 36 12 44-14 38 12 46-10 40 12 42-14 38 10 46-12 44 14 40-12 42 10 38-12 46 14 40-10 44 12 36-12 44 10 42-14 38 12 46-10 40 14 44-12 36 10 40-14 44 12 38-10 46 12 42-14 40 10 44-12 38 14 46-10 40 12 42-14 36 12 44-10 40 12 46-14 38 10 44-12 40 14 42-10 36 10 44-12 38 12V24Z"
          fill="currentColor"
        />
      </svg>

      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.3fr_1fr_1fr]">
        <div data-reveal>
          <Link href="/" className="inline-flex items-center gap-3">
            <LogoMark className="h-12 w-12" />
            <span className="font-display text-4xl font-bold leading-none tracking-tight">
              World <em className="font-medium italic text-primary">View</em>
            </span>
          </Link>
          <p className="mt-4 max-w-sm text-muted-foreground">
            Sports, screens and tech, plus whatever else caught our eye. Pull up a
            chair.
          </p>
          <p className="font-hand mt-5 inline-flex items-center gap-2 text-2xl text-primary">
            <Coffee className="h-5 w-5" aria-hidden="true" /> fuelled by far too much coffee
          </p>
        </div>

        <nav aria-label="Footer sections" data-reveal style={{ ["--reveal-delay" as string]: "100ms" }}>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Sections
          </h2>
          <ul className="mt-4 space-y-3">
            {SECTIONS.map(({ id, icon: Icon }) => (
              <li key={id}>
                <Link
                  href={`/posts?author=${CATEGORIES[id].author}`}
                  className="nav-link"
                  data-cat={id}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {CATEGORIES[id].label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Elsewhere on the web" data-reveal style={{ ["--reveal-delay" as string]: "200ms" }}>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Elsewhere
          </h2>
          <ul className="mt-4 space-y-3">
            <li>
              <Link href="/feed.xml" className="nav-link">
                <Rss className="h-5 w-5" aria-hidden="true" /> RSS feed
              </Link>
            </li>
            <li>
              <Link
                href="https://github.com/mwihoti/worldView"
                target="_blank"
                rel="noreferrer"
                className="nav-link"
              >
                <GitHubLogoIcon className="h-5 w-5" /> The code
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t-2 border-dashed border-border py-5 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} {title}
      </div>
    </footer>
  );
}
