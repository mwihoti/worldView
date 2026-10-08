"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clapperboard, Laptop, Menu, Rss, Trophy, X } from "lucide-react";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { LogoMark, Wordmark } from "./logo";
import ReaderSettings from "./reader-settings";
import { CATEGORIES, type CategoryId } from "@/lib/category";

const GITHUB_URL = "https://github.com/mwihoti/worldView";

const SECTIONS: { id: CategoryId; icon: typeof Trophy }[] = [
  { id: "sports", icon: Trophy },
  { id: "screen", icon: Clapperboard },
  { id: "tech", icon: Laptop },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  // Lock page scroll behind the open menu; Escape closes it.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="site-header">
      <div className="bar py-3">
        <div className="wrap flex items-center justify-between gap-4">
          <Link href="/" className="logo group flex items-center gap-2.5" onClick={close}>
            <LogoMark />
            <Wordmark />
          </Link>

          <nav aria-label="Sections" className="hidden items-center gap-7 lg:flex">
            {SECTIONS.map(({ id, icon: Icon }) => (
              <Link
                key={id}
                data-cat={id}
                href={`/posts?author=${CATEGORIES[id].author}`}
                className="nav-link"
              >
                <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
                {CATEGORIES[id].label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href="/feed.xml"
              aria-label="RSS feed"
              className="hidden h-10 w-10 items-center justify-center rounded-full border-2 border-transparent hover:border-ink sm:inline-flex"
            >
              <Rss className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
            </Link>
            <ReaderSettings />
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="hidden h-10 w-10 items-center justify-center rounded-full border-2 border-transparent hover:border-ink sm:inline-flex"
            >
              <GitHubLogoIcon className="h-[1.15rem] w-[1.15rem]" />
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-card lg:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu: a full-height sheet whose links drop in one by one. */}
      <div
        id="mobile-menu"
        hidden={!menuOpen}
        className="fixed inset-x-0 bottom-0 top-[4.4rem] z-40 overflow-y-auto border-t-2 border-ink bg-background lg:hidden"
      >
        <nav aria-label="Sections" className="wrap flex flex-col gap-3 py-8">
          {SECTIONS.map(({ id, icon: Icon }, i) => (
            <Link
              key={id}
              data-cat={id}
              href={`/posts?author=${CATEGORIES[id].author}`}
              onClick={close}
              style={{ animationDelay: `${80 + i * 90}ms` }}
              className="sticker animate-in fade-in-0 slide-in-from-bottom-6 flex items-center gap-4 p-4 duration-500 fill-mode-both"
            >
              <span className="cat-badge">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-display text-2xl font-bold leading-tight">
                  {CATEGORIES[id].label}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {CATEGORIES[id].blurb}
                </span>
              </span>
            </Link>
          ))}
          <div className="mt-4 flex gap-3 font-semibold">
            <Link href="/feed.xml" onClick={close} className="btn-ink is-plain">
              <Rss className="h-4 w-4" aria-hidden="true" /> RSS
            </Link>
            <Link href={GITHUB_URL} target="_blank" rel="noreferrer" className="btn-ink is-plain">
              <GitHubLogoIcon /> GitHub
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
