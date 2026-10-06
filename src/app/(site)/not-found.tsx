import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="wrap flex flex-col items-center py-28 text-center">
      <p className="kicker">Error 404</p>
      <h1 className="headline mt-3 text-5xl sm:text-6xl">Page not found</h1>
      <p className="mt-4 max-w-md text-lg text-muted-foreground">
        That page isn&apos;t here. It may have moved, or the link might have a typo.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn">
          Back to the front page
        </Link>
        <Link href="/posts" className="btn-outline">
          All stories
        </Link>
      </div>
    </main>
  );
}
