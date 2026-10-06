import { ImageResponse } from "next/og";
import { coverSvg, type CoverCategory } from "./cover-art";

/*
 * Social-share card (1200×630 PNG): the post's generated cover art with a
 * navy fade, the section in orange and the headline in white, like the
 * site's masthead. Sharing sites don't accept SVG, so posts without an
 * uploaded cover would otherwise have no preview image at all.
 */

const NAVY = "#0C1A30";
const ORANGE = "#EB7A3C";

export const OG_SIZE = { width: 1200, height: 630 };

export function ogCard({
  title,
  eyebrow,
  seed,
  category,
}: {
  title: string;
  eyebrow: string;
  seed: string;
  category: CoverCategory;
}): ImageResponse {
  const art = `data:image/svg+xml;base64,${Buffer.from(coverSvg({ seed, category })).toString("base64")}`;
  const size = title.length > 90 ? 50 : title.length > 55 ? 60 : 70;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: NAVY }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art} width={1200} height={750} alt="" style={{ position: "absolute", top: -60, left: 0 }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: "flex",
            backgroundImage: "linear-gradient(to bottom, rgba(12,26,48,0) 15%, rgba(12,26,48,0.85) 58%, rgba(12,26,48,1) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 72,
            right: 72,
            bottom: 64,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: 4, textTransform: "uppercase", color: ORANGE }}>
            {eyebrow}
          </div>
          <div style={{ display: "flex", fontSize: size, fontWeight: 700, lineHeight: 1.1, color: "#FFFFFF" }}>
            {title}
          </div>
          <div style={{ display: "flex", width: 120, height: 4, background: ORANGE, marginTop: 6 }} />
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
