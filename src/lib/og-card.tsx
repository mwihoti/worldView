import { ImageResponse } from "next/og";
import { coverSvg, type CoverCategory } from "./cover-art";

/*
 * Social-share card (1200×630 PNG): the post's generated cover art behind a
 * paper "sticker" with the title and section, in the site's notebook style.
 * Sharing sites don't accept SVG, so posts without an uploaded cover would
 * otherwise have no preview image at all.
 */

const INK = "#1B1A17";
const PAPER = "#FFF8EA";

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
  const size = title.length > 90 ? 46 : title.length > 55 ? 56 : 66;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: INK }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art} width={1200} height={750} alt="" style={{ position: "absolute", top: -60, left: 0 }} />
        <div
          style={{
            position: "absolute",
            left: 56,
            right: 56,
            bottom: 56,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            padding: "34px 40px",
            background: PAPER,
            border: `6px solid ${INK}`,
            borderRadius: 22,
            boxShadow: `14px 14px 0 ${INK}`,
          }}
        >
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: "#5A5348" }}>
            {eyebrow}
          </div>
          <div style={{ display: "flex", fontSize: size, fontWeight: 700, lineHeight: 1.08, color: INK }}>
            {title}
          </div>
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
