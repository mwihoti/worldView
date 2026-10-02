/*
 * Cover files live in a versioned folder. Browsers, the CDN and Next's image
 * optimiser all cache by URL, so redrawing the artwork under the same file
 * name would keep serving the old pictures; bump COVER_VERSION (and re-run
 * scripts/generate-covers.mjs) to publish a new set under fresh URLs.
 * Dependency-free so that script can import it directly.
 */
export const COVER_VERSION = "v2";

export function coverUrl(cover: string): string {
  const file = cover.split("/").pop() ?? cover;
  return `/covers/${COVER_VERSION}/${file}`;
}
