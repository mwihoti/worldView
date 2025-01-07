"use client";

import Link from "next/link";
import ThemeToggler from "./theme-toggler";
import { Button } from "./ui/button";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faTimes, faFutbol, faFilm, faLaptopCode } from "@fortawesome/free-solid-svg-icons";

const GITHUB_URL = "https://github.com/mwihoti/worldView";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const closeMenu = () => setMenuOpen(false);

  const title = { displayTitle: "World View" };

  return (
    <div className="w-full border-b mb-5 bg-white shadow-md">
      <div className="max-w-7xl w-full px-5 xl:px-0 mx-auto flex justify-between items-center py-2">
        {/* Blog Title */}
        <div className="text-xl font-bold">
          <Link href="/">{title.displayTitle || "My Blog"}</Link>
        </div>

        {/* Menu Button (Mobile) */}
        <button
          onClick={toggleMenu}
          className="lg:hidden text-2xl text-gray-700 focus:outline-none"
        >
          <FontAwesomeIcon icon={menuOpen ? faTimes : faBars} />
        </button>

        {/* Navigation Links */}
        <div
          className={`fixed lg:static top-0 left-0 w-full lg:w-auto h-[50vh] lg:h-auto bg-white lg:bg-transparent transition-transform transform ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 z-10`}
        >
          {/* Close menu overlay */}
          {menuOpen && (
            <div
              onClick={closeMenu}
              className="fixed top-0 left-0 w-full h-screen bg-black bg-opacity-50 lg:hidden"
            />
          )}

          <nav className="flex flex-col lg:flex-row items-center gap-5 lg:gap-8 p-4 lg:p-0 relative z-20">
            <Link
              href="/posts?author=Dennis"
              className="text-lg flex items-center gap-2 hover:text-blue-500"
              onClick={closeMenu}
            >
              <FontAwesomeIcon icon={faFutbol} /> Sports
            </Link>
            <Link
              href="/posts?author=Danny"
              className="text-lg flex items-center gap-2 hover:text-blue-500"
              onClick={closeMenu}
            >
              <FontAwesomeIcon icon={faFilm} /> Movies & TV Shows
            </Link>
            <Link
              href="/posts?author=Daniel"
              className="text-lg flex items-center gap-2 hover:text-blue-500"
              onClick={closeMenu}
            >
              <FontAwesomeIcon icon={faLaptopCode} /> Tech
            </Link>

            {/* Theme Toggler */}
            <div className="mt-5 lg:mt-0">
              <ThemeToggler />
            </div>

            {/* GitHub Button */}
            <Button variant="secondary" className="mt-5 lg:mt-0">
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
    </div>
  );
}
