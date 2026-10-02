import Link from "next/link";
import { ArrowDown, ArrowRight, Clapperboard, Laptop, Trophy } from "lucide-react";
import HeroDoodle from "./hero-doodle";
import { CATEGORIES, type CategoryId } from "@/lib/category";

const SECTIONS: { id: CategoryId; icon: typeof Trophy }[] = [
  { id: "sports", icon: Trophy },
  { id: "screen", icon: Clapperboard },
  { id: "tech", icon: Laptop },
];

export default function Hero() {
  return (
    <section className="wrap relative grid items-center gap-10 pb-14 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-6 lg:pb-20 lg:pt-14">
      <div className="min-w-0">
        <p
          data-enter="fade"
          className="font-hand text-3xl leading-none text-primary sm:text-4xl"
        >
          hello, reader
          <svg
            viewBox="0 0 70 36"
            className="draw ml-2 inline-block h-7 w-14 translate-y-1 text-ink"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 6c14 2 26 8 34 20M37 26l-12-3m12 3l2-13"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
            />
          </svg>
        </p>

        <h1
          data-enter
          className="font-display mt-3 text-[clamp(2.05rem,9vw,2.9rem)] font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.4rem]"
          style={{ ["--reveal-delay" as string]: "80ms" }}
        >
          Sports, screens, tech &mdash; and the{" "}
          <span className="scribble italic text-primary">stories in between.</span>
        </h1>

        <p
          data-enter
          className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
          style={{ ["--reveal-delay" as string]: "200ms" }}
        >
          A small, opinionated corner of the internet. Short reads you can finish
          before your coffee goes cold.
        </p>

        <div
          data-enter
          className="mt-8 flex flex-wrap items-center gap-4"
          style={{ ["--reveal-delay" as string]: "320ms" }}
        >
          <Link href="#latest" className="btn-ink">
            Start reading <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/posts" className="btn-ink is-plain">
            Browse everything <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <ul className="mt-10 flex flex-wrap gap-3" aria-label="Sections">
          {SECTIONS.map(({ id, icon: Icon }, i) => (
            <li
              key={id}
              data-enter="pop"
              data-cat={id}
              style={{ ["--reveal-delay" as string]: `${440 + i * 90}ms` }}
            >
              <Link
                href={`/posts?author=${CATEGORIES[id].author}`}
                className="sticker sticker-flat sticker-hover inline-flex items-center gap-2.5 rounded-full py-2 pl-2 pr-4 font-semibold"
                style={{ ["--hover-tilt" as string]: i % 2 ? "1.5deg" : "-1.5deg" }}
              >
                <span className="cat-badge !h-8 !w-8">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {CATEGORIES[id].label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div data-enter="pop" style={{ ["--reveal-delay" as string]: "150ms" }}>
        <HeroDoodle />
      </div>
    </section>
  );
}
