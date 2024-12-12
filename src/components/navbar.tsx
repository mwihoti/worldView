"use client";

import Link from "next/link";
import ThemeToggler from "./theme-toggler";
import { Button } from "./ui/button";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { getBlogName } from "@/lib/requests";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faTimes, faFutbol, faFilm, faLaptopCode } from "@fortawesome/free-solid-svg-icons";

const GITHUB_URL = "https://github.com/mwihoti/worldView";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const title = { displayTitle: "World View" }; // Replace with a proper call to `getBlogName` if needed in a client-safe way.

  return (
    <div className="w-full border-b mb-5 bg-white shadow-md">
      <div className="max-w-7xl w-full px-5 xl:px-0 mx-auto flex justify-between items-center py-4">
        {/* Blog Title */}
        <div className="text-2xl font-bold">
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
          className={`flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8 fixed lg:static top-0 left-0 w-full lg:w-auto h-screen lg:h-auto bg-white lg:bg-transparent transition-transform transform ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0`}
        >
          <nav className="flex flex-col lg:flex-row items-center gap-5 lg:gap-8 p-6 lg:p-0">
            <Link
              href="/posts?author=Dennis"
              className="text-lg flex items-center gap-2 hover:text-blue-500"
            >
              <FontAwesomeIcon icon={faFutbol} /> Sports
            </Link>
            <Link
              href="/posts?author=Danny"
              className="text-lg flex items-center gap-2 hover:text-blue-500"
            >
              <FontAwesomeIcon icon={faFilm} /> Movies & TV Shows
            </Link>
            <Link
              href="/posts?author=Daniel"
              className="text-lg flex items-center gap-2 hover:text-blue-500"
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
