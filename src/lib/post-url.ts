/*
 * Path of a post's page. Slugs are percent-encoded so any slug is reachable:
 * browsers silently strip a trailing space from a link, so a post stored as
 * "UbuTangaza " (pasted with a trailing space) linked to "/UbuTangaza ",
 * became a request for "/UbuTangaza", and 404ed. Encoded it is "/UbuTangaza%20",
 * which survives and decodes back to the stored slug. New slugs are cleaned on
 * save (see the slug field in collections.ts), so for those this is a no-op.
 */
export function postPath(slug: string): string {
  return `/${encodeURIComponent(slug)}`;
}

/*
 * The slug from the URL, decoded. Next.js hands the encoded form ("a%20b") to
 * a page component but the decoded one ("a b") to generateMetadata, so the
 * title of a post whose slug needed encoding was found while its body was a
 * 404. Decoding is a no-op on an already-decoded slug; a malformed sequence
 * (a literal "%") falls back to the raw value.
 */
export function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
