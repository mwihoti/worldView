"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    __revealReady?: boolean;
  }
}

const SELECTOR = "[data-reveal]";

/*
 * Fades blocks in as they scroll into view: CSS does the animating, this
 * only adds the `in` class. Server components just add `data-reveal`; a
 * mutation observer picks up content added later (Load more, navigation).
 * With reduced motion, or without IntersectionObserver, everything simply
 * shows.
 */
export default function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      root.classList.add("reveal-failsafe");
      return;
    }
    window.__revealReady = true;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Scrolled past before it ever appeared (e.g. a reload mid-page):
          // show it without the entrance.
          const above = entry.boundingClientRect.bottom < 0;
          if (entry.isIntersecting || above) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.08 }
    );

    const watch = (scope: ParentNode) => {
      scope.querySelectorAll(SELECTOR).forEach((el) => {
        if (!el.classList.contains("in")) io.observe(el);
      });
    };
    watch(document);

    const mo = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(SELECTOR) && !node.classList.contains("in")) io.observe(node);
          watch(node);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);

  return null;
}
