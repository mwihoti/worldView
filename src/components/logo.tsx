import { cn } from "@/lib/utils";

/* A doodled globe with an orbit arc: the mark for the site. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn("logo-mark h-9 w-9 text-ink", className)}
    >
      <circle
        cx="22"
        cy="26"
        r="15"
        fill="hsl(var(--card))"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <path
        d="M22 11c-6.5 5.5-6.5 24.5 0 30M22 11c6.5 5.5 6.5 24.5 0 30M7.5 26h29M10 18.5c8 3 16 3 24 0M10 33.5c8-3 16-3 24 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M29 7.5c7 .8 12.5 6 12.5 13.5"
        stroke="hsl(var(--primary))"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle
        cx="41.5"
        cy="23"
        r="3.2"
        fill="hsl(var(--primary))"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-[1.6rem] leading-none tracking-tight", className)}>
      <span className="font-bold">World</span>{" "}
      <em className="font-medium italic text-primary">View</em>
    </span>
  );
}
