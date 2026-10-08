import { Clapperboard, Laptop, Trophy } from "lucide-react";

/*
 * The hero picture: a hand-drawn globe with a paper plane circling it and a
 * trophy, clapperboard and laptop floating around. The "boil" class swaps
 * between three slightly different wobble filters a few times a second, the
 * way hand-animated line art shimmers; the shared <svg> below defines them.
 */
export function WobbleFilters() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        {(["a", "b", "c"] as const).map((id, i) => (
          <filter key={id} id={`wob-${id}`} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.022"
              numOctaves="2"
              seed={[3, 11, 27][i]}
              result="n"
            />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="5" />
          </filter>
        ))}
      </defs>
    </svg>
  );
}

const STICKERS = [
  { Icon: Trophy, cat: "sports", pos: "left-[2%] top-[14%]", r: "-8deg", speed: -0.16, dur: "7s", delay: "0s" },
  { Icon: Clapperboard, cat: "screen", pos: "right-[0%] top-[34%]", r: "7deg", speed: -0.05, dur: "8s", delay: "-2s" },
  { Icon: Laptop, cat: "tech", pos: "left-[10%] bottom-[8%]", r: "5deg", speed: -0.11, dur: "9s", delay: "-4s" },
] as const;

export default function HeroDoodle() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[34rem] text-ink" aria-hidden="true">
      <WobbleFilters />

      <div className="parallax absolute inset-0" style={{ ["--speed" as string]: -0.06 }}>
        <svg viewBox="0 0 520 520" className="boil absolute inset-0 h-full w-full" fill="none">
          {/* sun-ish blob behind the globe */}
          <path
            d="M96 290c-14-88 52-182 152-198 98-16 186 40 204 138 16 90-44 188-142 206-100 18-200-46-214-146Z"
            fill="hsl(var(--marker) / var(--marker-alpha))"
            stroke="currentColor"
            strokeWidth="4"
          />
          {/* dotted orbit ring */}
          <ellipse
            cx="260"
            cy="260"
            rx="222"
            ry="72"
            transform="rotate(-18 260 260)"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="2 12"
            strokeLinecap="round"
          />
          {/* globe */}
          <circle cx="260" cy="262" r="136" fill="hsl(var(--card))" stroke="currentColor" strokeWidth="6" />
          <path
            d="M260 126c-52 44-52 220 0 272M260 126c52 44 52 220 0 272M124 262h272M142 198c76 28 160 28 236 0M142 326c76-28 160-28 236 0"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* continents */}
          <path
            d="M206 188c18-10 40-4 48 12s-6 30-24 34-34-6-38-22 4-16 14-24Z"
            fill="hsl(var(--c-tech))"
            stroke="currentColor"
            strokeWidth="3.5"
          />
          <path
            d="M296 250c22-6 46 8 44 30s-18 42-40 40-30-22-26-40 8-26 22-30Z"
            fill="hsl(var(--c-sports))"
            stroke="currentColor"
            strokeWidth="3.5"
          />
          <path
            d="M214 296c12-6 28 0 30 14s-8 26-22 26-22-12-20-24 4-12 12-16Z"
            fill="hsl(var(--c-screen))"
            stroke="currentColor"
            strokeWidth="3.5"
          />
          {/* confetti */}
          <path d="M70 120l12 12m0-12L70 132" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" />
          <circle cx="452" cy="96" r="9" stroke="currentColor" strokeWidth="4" />
          <path d="M440 430l10-18 10 18Z" fill="hsl(var(--c-story))" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M96 440q16-18 32 0t32 0" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <circle cx="478" cy="300" r="6" fill="hsl(var(--primary))" />
        </svg>

        {/* paper plane flying the orbit */}
        <svg
          viewBox="0 0 520 520"
          className="absolute inset-0 h-full w-full overflow-visible"
          fill="none"
        >
          <g className="orbit-plane">
            <path
              d="M-16 -9L18 0L-16 9L-9 0Z"
              fill="hsl(var(--card))"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>

      {STICKERS.map(({ Icon, cat, pos, r, speed, dur, delay }) => (
        <div
          key={cat}
          className={`parallax absolute ${pos}`}
          style={{ ["--speed" as string]: speed }}
        >
          <div
            data-cat={cat}
            className="floaty sticker flex h-[4.4rem] w-[4.4rem] items-center justify-center rounded-2xl"
            style={{ ["--r" as string]: r, ["--dur" as string]: dur, ["--delay" as string]: delay }}
          >
            <Icon className="h-9 w-9" style={{ color: "hsl(var(--cat))" }} strokeWidth={2.2} />
          </div>
        </div>
      ))}
    </div>
  );
}
