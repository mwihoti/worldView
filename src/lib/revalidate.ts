import { revalidatePath } from "next/cache";

/*
 * The public pages are statically cached (revalidate = 300), so an article
 * published in the admin would otherwise take up to five minutes to appear.
 * Payload hooks call this after every change so the next visit re-renders.
 * revalidatePath only works inside a request; hooks also run from the CLI
 * and build, so failures are swallowed.
 */
export function revalidateSite(slugs: Array<string | null | undefined> = []): void {
  const paths = new Set<string>(["/", "/posts", "/feed.xml", "/sitemap.xml"]);
  for (const slug of slugs) {
    if (typeof slug === "string" && slug.trim()) paths.add(`/${slug.trim()}`);
  }
  paths.forEach((path) => {
    try {
      revalidatePath(path);
    } catch {
      /* not in a request context (CLI, build) */
    }
  });
}
