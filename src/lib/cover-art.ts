/*
 * Generative cover art for posts without a photo. Editorial rather than
 * playful: a deep, muted field in the section's colour, a soft warm light,
 * fine contour lines like a relief map (it is WorldView, after all) and a
 * thin line drawing for the section. Seeded by the slug, so a post always
 * gets the same picture, and two posts in a row never quite match.
 *
 * Self-contained on purpose (no imports): the React component renders the
 * string inline, and scripts/generate-covers.mjs writes the same output to
 * public/covers/<version>/*.svg for the posts that ship with cover files.
 */

export type CoverCategory = "sports" | "screen" | "tech" | "story";

const PALETTES: Record<CoverCategory, { from: string; to: string; glow: string; line: string }> = {
  story: { from: "#1C355C", to: "#0B1A30", glow: "#E8823F", line: "#F3E6D3" },
  sports: { from: "#1F5741", to: "#0C2A1F", glow: "#E9B44C", line: "#EEF2E6" },
  screen: { from: "#5A2440", to: "#24101C", glow: "#F08A5D", line: "#F6E4E8" },
  tech: { from: "#18485A", to: "#0A2230", glow: "#5CC8D8", line: "#E3F1F4" },
};

function hash(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v: number) => Math.round(v * 10) / 10;

/* One closed, gently irregular ring: a circle whose radius wobbles with a
 * few low-frequency harmonics shared by every ring, so the rings nest like
 * the contour lines of a hill. */
function ring(cx: number, cy: number, r: number, harmonics: number[][], squash: number): string {
  const steps = 72;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    let rr = r;
    for (const [freq, amp, phase] of harmonics) rr += Math.sin(a * freq + phase) * amp * r;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * squash;
    d += `${i === 0 ? "M" : "L"}${n(x)} ${n(y)}`;
  }
  return d + "Z";
}

/* Thin line drawings, centred on 0,0, roughly 300 units across. */
function motif(category: CoverCategory, variant: number): string {
  if (category === "sports") {
    if (variant === 1) {
      // trophy
      return (
        `<path d="M-80 -110H80V-30C80 30 40 66 0 66C-40 66-80 30-80 -30Z"/>` +
        `<path d="M-80 -86H-128C-128 -36-104 -10-74 -10M80 -86H128C128 -36 104 -10 74 -10"/>` +
        `<path d="M-22 66V110H22V66M-66 110H66V138H-66Z"/>`
      );
    }
    // football
    const pent = Array.from({ length: 5 }, (_, k) => {
      const a = ((-90 + k * 72) * Math.PI) / 180;
      return [Math.cos(a) * 44, Math.sin(a) * 44];
    });
    return (
      `<circle r="130"/>` +
      `<path d="M${pent.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}Z"/>` +
      `<path d="${pent.map(([x, y]) => `M${n(x)} ${n(y)}L${n(x * 2.6)} ${n(y * 2.6)}`).join("")}"/>`
    );
  }
  if (category === "screen") {
    if (variant === 1) {
      // television
      return (
        `<path d="M-30 -96L-80 -150M30 -96L80 -150"/>` +
        `<rect x="-160" y="-96" width="320" height="210" rx="26"/>` +
        `<rect x="-128" y="-66" width="206" height="150" rx="14"/>` +
        `<circle cx="118" cy="-24" r="12"/><circle cx="118" cy="24" r="12"/>`
      );
    }
    // clapperboard
    return (
      `<rect x="-150" y="-40" width="300" height="190" rx="10"/>` +
      `<path d="M-150 -40L-160 -110L140 -150L150 -80"/>` +
      `<path d="M-100 -116L-70 -52M-30 -126L0 -60M40 -135L70 -68M110 -144L136 -80"/>` +
      `<path d="M-30 30V110L40 70Z"/>`
    );
  }
  if (category === "tech") {
    if (variant === 1) {
      // terminal window
      return (
        `<rect x="-170" y="-120" width="340" height="240" rx="18"/>` +
        `<path d="M-170 -70H170"/>` +
        `<circle cx="-136" cy="-95" r="7"/><circle cx="-108" cy="-95" r="7"/><circle cx="-80" cy="-95" r="7"/>` +
        `<path d="M-120 -20L-76 14L-120 48M-50 52H30"/>`
      );
    }
    // chip
    const legs = [-60, -20, 20, 60]
      .map((v) => `M${v} -100V-140M${v} 100V140M-100 ${v}H-140M100 ${v}H140`)
      .join("");
    return (
      `<path d="${legs}"/>` +
      `<rect x="-100" y="-100" width="200" height="200" rx="22"/>` +
      `<rect x="-48" y="-48" width="96" height="96" rx="10"/>`
    );
  }
  if (variant === 1) {
    // compass rose
    return (
      `<circle r="130"/><circle r="104"/>` +
      `<path d="M0 -150L22 -22L150 0L22 22L0 150L-22 22L-150 0L-22 -22Z"/>` +
      `<path d="M0 -150V150M-150 0H150"/>`
    );
  }
  // globe
  return (
    `<circle r="130"/>` +
    `<ellipse rx="56" ry="130"/>` +
    `<ellipse rx="130" ry="46"/>` +
    `<path d="M-130 0H130M0 -130V130"/>` +
    `<ellipse rx="200" ry="58" transform="rotate(-16)" stroke-dasharray="3 14"/>`
  );
}

export function coverSvg(opts: { seed: string; category: CoverCategory }): string {
  const { seed, category } = opts;
  const p = PALETTES[category];
  const h = hash(seed);
  const rand = rng(h);
  const id = h.toString(36);

  // Where the "hill" of contour lines peaks, and the light behind it.
  const cx = 260 + rand() * 680;
  const cy = 240 + rand() * 300;
  const harmonics = [
    [2, 0.07 + rand() * 0.05, rand() * 6.28],
    [3, 0.04 + rand() * 0.04, rand() * 6.28],
    [5, 0.015 + rand() * 0.02, rand() * 6.28],
  ];
  const squash = 0.55 + rand() * 0.3;
  const rings: string[] = [];
  for (let i = 0; i < 16; i++) {
    const r = 40 + i * (46 + rand() * 6);
    const opacity = n(0.26 - i * 0.012);
    rings.push(`<path d="${ring(cx, cy, r, harmonics, squash)}" opacity="${opacity}"/>`);
  }

  const glowX = n(((cx + (rand() - 0.5) * 300) / 1200) * 100);
  const glowY = n(((cy - 80) / 750) * 100);
  const variant = rand() < 0.5 ? 0 : 1;
  // Keep the drawing away from the contour peak so the two don't pile up.
  const mx = cx < 600 ? 820 + rand() * 120 : 260 + rand() * 120;
  const my = 330 + rand() * 90;
  const scale = n(0.8 + rand() * 0.25);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${p.from}"/><stop offset="1" stop-color="${p.to}"/>` +
    `</linearGradient>` +
    `<radialGradient id="l${id}" cx="${glowX}%" cy="${glowY}%" r="55%">` +
    `<stop offset="0" stop-color="${p.glow}" stop-opacity=".55"/>` +
    `<stop offset=".45" stop-color="${p.glow}" stop-opacity=".12"/>` +
    `<stop offset="1" stop-color="${p.glow}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="v${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect width="1200" height="750" fill="url(#g${id})"/>` +
    `<rect width="1200" height="750" fill="url(#l${id})"/>` +
    `<g fill="none" stroke="${p.line}" stroke-width="1.6">${rings.join("")}</g>` +
    `<g transform="translate(${n(mx)} ${n(my)}) scale(${scale})" fill="none" stroke="${p.line}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".9">${motif(category, variant)}</g>` +
    `<path d="M0 ${n(612 + rand() * 40)}H1200" stroke="${p.glow}" stroke-width="2" opacity=".55"/>` +
    `<rect width="1200" height="750" fill="url(#v${id})"/>` +
    `</svg>`
  );
}
