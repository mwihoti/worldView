"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="wrap my-20 flex flex-col items-center gap-5 text-center">
      <p className="font-hand text-3xl text-primary">oops &mdash; that wasn&apos;t supposed to happen</p>
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
        Something went wrong
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        We couldn&apos;t load this page. Give it another try; if it keeps
        happening, it&apos;s on us.
      </p>
      <button type="button" onClick={reset} className="btn-ink">
        <RotateCw className="h-4 w-4" aria-hidden="true" /> Try again
      </button>
    </main>
  );
}
