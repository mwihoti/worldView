import { Clapperboard, Globe, Laptop, Trophy } from "lucide-react";

const ITEMS = [
  { label: "Sports", Icon: Trophy },
  { label: "Movies & TV", Icon: Clapperboard },
  { label: "Tech", Icon: Laptop },
  { label: "The wider world", Icon: Globe },
];

/* A slow-scrolling ticker of the site's sections. Decorative; hover pauses. */
export default function Marquee() {
  const row = (
    <ul className="flex shrink-0 items-center" aria-hidden="true">
      {Array.from({ length: 3 }).flatMap((_, round) =>
        ITEMS.map(({ label, Icon }) => (
          <li
            key={`${round}-${label}`}
            className="flex items-center gap-5 px-5 font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl"
          >
            <Icon className="h-7 w-7 text-primary" strokeWidth={2.4} />
            <span>{label}</span>
            <span className="font-hand text-3xl font-normal normal-case text-muted-foreground">
              &amp;
            </span>
          </li>
        ))
      )}
    </ul>
  );
  return (
    <div className="marquee overflow-hidden border-y-2 border-ink bg-card py-4" role="presentation">
      <div className="marquee-track">
        {row}
        {row}
      </div>
    </div>
  );
}
