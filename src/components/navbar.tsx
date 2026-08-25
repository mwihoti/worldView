"use client";

import Link from "next/link";
import { useState } from "react";
import { Clapperboard, Laptop, Menu, Trophy, X } from "lucide-react";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import ThemeToggler from "./theme-toggler";
import { Button } from "./ui/button";

const GITHUB_URL = "https://github.com/mwihoti/worldView";

const NAV_LINKS = [
  { href: "/posts?author=Dennis", label: "Sports", icon: Trophy },
  { href: "/posts?author=Danny", label: "Movies & TV Shows", icon: Clapperboard },
  { href: "/posts?author=Daniel", label: "Tech", icon: Laptop },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b mb-5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="max-w-7xl w-full px-5 xl:px-0 mx-auto flex justify-between items-center py-2">
        <div className="text-xl font-bold">
          <Link href="/">World View</Link>
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="lg:hidden text-foreground"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        <div
          className={`fixed lg:static top-0 left-0 w-64 lg:w-auto h-screen lg:h-auto bg-background lg:bg-transparent border-r lg:border-0 transition-transform ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 z-10`}
        >
          {menuOpen && (
            <div
              onClick={closeMenu}
              className="fixed top-0 left-64 w-screen h-screen bg-black/50 lg:hidden"
            />
          )}

          <nav className="flex flex-col lg:flex-row items-start lg:items-center gap-5 lg:gap-8 p-5 lg:p-0 relative z-20">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="text-lg flex items-center gap-2 hover:text-primary transition-colors"
                onClick={closeMenu}
              >
                <Icon className="h-5 w-5" /> {label}
              </Link>
            ))}

            <ThemeToggler />

            <Button asChild variant="secondary">
              <Link
                className="gap-2 flex items-center"
                href={GITHUB_URL}
                target="_blank"
              >
                <GitHubLogoIcon /> GitHub
              </Link>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
