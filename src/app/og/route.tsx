import { getPublication } from "@/lib/requests";
import { ogCard } from "@/lib/og-card";

/* GET /og — the site-wide share image (home page, post lists). */
export const revalidate = 86400;

export async function GET() {
  const publication = await getPublication();
  return ogCard({
    title: "News, sports, movies and tech stories from around the world",
    eyebrow: publication.displayTitle || publication.title,
    seed: "worldview-home",
    category: "story",
  });
}
