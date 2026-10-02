import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main id="main" className="wrap my-20 flex flex-col items-center gap-6 text-center">
      <div className="relative">
        <Compass className="wiggle h-28 w-28 text-primary" strokeWidth={1.4} aria-hidden="true" />
      </div>
      <p className="font-hand text-3xl text-primary">well, this is awkward&hellip;</p>
      <h1 className="font-display text-6xl font-bold tracking-tight sm:text-7xl">
        404
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        We looked everywhere, but that page isn&apos;t on the map. It may have moved,
        or the link might have a typo.
      </p>
      <Link href="/" className="btn-ink">
        Take me home
      </Link>
    </main>
  );
}
