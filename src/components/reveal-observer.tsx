"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    __revealReady?: boolean;
  }
}

/* Anything marked data-reveal, and every direct child of an article body. */
const SELECTOR = "[data-reveal], .blog-content > *";

/*
 * The site's scroll engine, mounted once in the layout:
 *  - fades/slides elements in as they enter the viewport (CSS does the
 *    animating, this only adds the `in` class),
 *  - keeps `--scroll-y` up to date near the top of the page for parallax,
 *  - flags `data-scrolled` on <html> so the header can switch to its
 *    blurred, outlined state.
 * Server components just add `data-reveal` to what they render; a mutation
 * observer picks up content added later (Load more, client navigation).
 */
export default function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let lastParallax = -1;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      if (y > 12) root.setAttribute("data-scrolled", "");
      else root.removeAttribute("data-scrolled");
      // Parallax only matters near the top (hero, article cover): stop
      // touching the root's styles once the reader is well past it.
      if (!reduce && (y < 1600 || lastParallax < 1600)) {
        root.style.setProperty("--scroll-y", String(Math.round(Math.min(y, 1600))));
        lastParallax = y;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

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
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 }
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
