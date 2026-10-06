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
    <main id="main" className="wrap flex flex-col items-center py-28 text-center">
      <p className="kicker">Something went wrong</p>
      <h1 className="headline mt-3 text-4xl sm:text-5xl">We couldn&apos;t load this page</h1>
      <p className="mt-4 max-w-md text-lg text-muted-foreground">
        Give it another try. If it keeps happening, it&apos;s on us.
      </p>
      <button type="button" onClick={reset} className="btn mt-8">
        <RotateCw className="h-4 w-4" aria-hidden="true" /> Try again
      </button>
    </main>
  );
}
