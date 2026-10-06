"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Moon, Search, Sun, X } from "lucide-react";
import { CATEGORIES, SECTION_ORDER, sectionHref } from "@/lib/category";

const LINKS = [
  { href: "/", label: "Home", section: null as string | null },
  ...SECTION_ORDER.map((id) => ({
    href: sectionHref(CATEGORIES[id]),
    label: CATEGORIES[id].label,
    section: CATEGORIES[id].slug as string | null,
  })),
];

/* Reads the URL to mark the current page; split out so the rest of the
 * masthead can render before search params are known. */
function NavLinks({ onNavigate, className }: { onNavigate?: () => void; className: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const section = pathname === "/posts" ? params.get("section") : null;
  return (
    <>
      {LINKS.map((link) => {
        const current =
          link.section === null ? pathname === "/" : section === link.section;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            aria-current={current ? "page" : undefined}
            className={className}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

function StaticNavLinks({ className }: { className: string }) {
  return (
    <>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={className}>
          {link.label}
        </Link>
      ))}
    </>
  );
}

/* Icons swap through CSS (dark: variant), so the server render already
 * matches whichever theme the page loads in. */
function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      className="masthead-icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle dark mode"
    >
      <Moon className="h-5 w-5 dark:hidden" aria-hidden="true" />
      <Sun className="hidden h-5 w-5 dark:block" aria-hidden="true" />
    </button>
  );
}

function SubscribeButton({ newsletter, onClick }: { newsletter: boolean; onClick?: () => void }) {
  if (!newsletter) {
    // No newsletter configured: subscribing means the RSS feed.
    return (
      <Link href="/feed.xml" className="btn-subscribe" onClick={onClick}>
        Subscribe
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="btn-subscribe"
      onClick={() => {
        onClick?.();
        window.dispatchEvent(new Event("wv:subscribe"));
      }}
    >
      Subscribe
    </button>
  );
}

export default function Masthead({ newsletter }: { newsletter: boolean }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  // Escape closes whichever panel is open; the open menu locks page scroll.
  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    if (menuOpen) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [menuOpen, searchOpen]);

  return (
    <header className="masthead sticky top-0 z-50">
      <div className="wrap flex h-[4.5rem] items-center gap-6 lg:h-[5.85rem] lg:gap-10">
        <Link href="/" className="wordmark text-[1.9rem] sm:text-[2.2rem] lg:text-[2.75rem]" onClick={closeMenu}>
          WorldView
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-8 lg:flex xl:gap-11">
          <Suspense fallback={<StaticNavLinks className="masthead-link" />}>
            <NavLinks className="masthead-link" />
          </Suspense>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            className="masthead-icon"
            aria-label={searchOpen ? "Close search" : "Search stories"}
            aria-expanded={searchOpen}
            aria-controls="site-search"
            onClick={() => {
              setSearchOpen((open) => !open);
              setMenuOpen(false);
            }}
          >
            {searchOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Search className="h-[1.35rem] w-[1.35rem]" aria-hidden="true" />}
          </button>
          <ThemeSwitch />
          <div className="ml-2 hidden sm:block">
            <SubscribeButton newsletter={newsletter} />
          </div>
          <button
            type="button"
            className="masthead-icon lg:hidden"
            onClick={() => {
              setMenuOpen((open) => !open);
              setSearchOpen(false);
            }}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div id="site-search" className="border-t border-white/10">
          <form
            role="search"
            className="wrap flex items-center gap-3 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchInput.current?.value.trim();
              if (!q) return;
              setSearchOpen(false);
              router.push(`/posts?q=${encodeURIComponent(q)}`);
            }}
          >
            <label htmlFor="site-search-input" className="sr-only">
              Search stories
            </label>
            <Search className="h-5 w-5 flex-none opacity-70" aria-hidden="true" />
            <input
              ref={searchInput}
              id="site-search-input"
              type="search"
              name="q"
              placeholder="Search stories, sections, authors…"
              className="headline w-full bg-transparent text-xl font-normal text-masthead-foreground placeholder:text-masthead-foreground/50 focus:outline-none sm:text-2xl"
            />
            <button type="submit" className="btn-subscribe !py-1.5 !text-base">
              Search
            </button>
          </form>
        </div>
      )}

      <div
        id="mobile-menu"
        hidden={!menuOpen}
        className="fixed inset-x-0 bottom-0 top-[4.5rem] overflow-y-auto border-t border-white/10 bg-masthead lg:hidden"
      >
        <nav aria-label="Sections" className="wrap flex flex-col py-6">
          <Suspense fallback={<StaticNavLinks className="headline border-b border-white/10 py-4 text-2xl" />}>
            <NavLinks
              onNavigate={closeMenu}
              className="headline border-b border-white/10 py-4 text-2xl aria-[current=page]:text-masthead-accent"
            />
          </Suspense>
          <div className="mt-8">
            <SubscribeButton newsletter={newsletter} onClick={closeMenu} />
          </div>
        </nav>
      </div>
    </header>
  );
}
