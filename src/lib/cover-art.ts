/*
 * Generative cover art. Every post gets an illustration even when nobody
 * uploaded one: a paper-cut style composition (blob, dot grid, squiggle,
 * confetti) built from a seeded random generator, so the same slug always
 * draws the same picture, plus a chunky motif for the post's section. A
 * wobble filter makes the edges look hand-cut instead of vector-perfect.
 *
 * Self-contained on purpose (no imports): the React component renders the
 * string inline, and scripts/generate-covers.mjs writes the same output to
 * public/covers/*.svg for the posts that ship with static cover files.
 */

export type CoverCategory = "sports" | "screen" | "tech" | "story";

const INK = "#1B1A17";
const CREAM = "#FFF3DC";

const PALETTES: Record<
  CoverCategory,
  { bg: string; blob: string; accent: string; accent2: string }
> = {
  sports: { bg: "#E4572E", blob: "#F3A712", accent: "#FFF3DC", accent2: "#2D4E9B" },
  screen: { bg: "#28509E", blob: "#F4A6C4", accent: "#F3A712", accent2: "#E4572E" },
  tech: { bg: "#0E6B5C", blob: "#9EE6C4", accent: "#FF6F59", accent2: "#F3A712" },
  story: { bg: "#F2B134", blob: "#7A3B69", accent: "#FFF3DC", accent2: "#E4572E" },
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

function blobPath(rand: () => number, cx: number, cy: number, radius: number) {
  const count = 8;
  const pts = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const r = radius * (0.78 + rand() * 0.42);
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as const;
  });
  let d = `M${n(pts[0][0])} ${n(pts[0][1])}`;
  for (let i = 0; i < count; i++) {
    const p0 = pts[(i - 1 + count) % count];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % count];
    const p3 = pts[(i + 2) % count];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return d + "Z";
}

function squiggle(x: number, y: number, length: number, amp: number, waves: number) {
  const step = length / (waves * 2);
  let d = `M${n(x)} ${n(y)}`;
  for (let i = 0; i < waves * 2; i++) {
    const dir = i % 2 === 0 ? -1 : 1;
    d += `q${n(step / 2)} ${n(dir * amp)} ${n(step)} 0`;
  }
  return d;
}

function confetti(
  rand: () => number,
  colors: string[],
  avoid: { x: number; y: number; r: number }
) {
  const parts: string[] = [];
  for (let i = 0; i < 11; i++) {
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 40; tries++) {
      x = 70 + rand() * 1060;
      y = 70 + rand() * 610;
      if (Math.hypot(x - avoid.x, y - avoid.y) > avoid.r) break;
    }
    const color = colors[Math.floor(rand() * colors.length)];
    const size = 12 + rand() * 20;
    const kind = Math.floor(rand() * 5);
    const rot = Math.floor(rand() * 360);
    const g = (inner: string) =>
      `<g transform="translate(${n(x)} ${n(y)}) rotate(${rot})">${inner}</g>`;
    if (kind === 0) parts.push(g(`<circle r="${n(size / 2)}" fill="${color}"/>`));
    else if (kind === 1)
      parts.push(g(`<circle r="${n(size / 2)}" fill="none" stroke="${color}" stroke-width="5"/>`));
    else if (kind === 2)
      parts.push(
        g(
          `<path d="M${-size / 2} 0H${size / 2}M0 ${-size / 2}V${size / 2}" stroke="${color}" stroke-width="6" stroke-linecap="round"/>`
        )
      );
    else if (kind === 3)
      parts.push(
        g(`<path d="M0 ${-size / 2}L${size / 2} ${size / 2}H${-size / 2}Z" fill="${color}"/>`)
      );
    else
      parts.push(
        g(
          `<path d="M0 ${-size}Q0 0 ${size} 0Q0 0 0 ${size}Q0 0 ${-size} 0Q0 0 0 ${-size}Z" fill="${color}"/>`
        )
      );
  }
  return parts.join("");
}

/* Ink outline attributes. Width is a parameter so a shape never ends up with
 * two stroke-width attributes: browsers forgive that inline, but as a
 * standalone .svg (what <img> loads) it is invalid XML and fails to decode. */
const stroke = (width = 12) =>
  `stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;

function motif(category: CoverCategory, p: (typeof PALETTES)[CoverCategory], variant: number) {
  if (variant === 1) return altMotif(category, p);
  if (category === "sports") {
    const pentagon = Array.from({ length: 5 }, (_, k) => {
      const a = ((-90 + k * 72) * Math.PI) / 180;
      return [Math.cos(a) * 60, Math.sin(a) * 60];
    });
    const spokes = pentagon
      .map(([x, y]) => `M${n(x)} ${n(y)}L${n(x * 2.45)} ${n(y * 2.45)}`)
      .join("");
    return (
      `<circle r="170" fill="${CREAM}" ${stroke()}/>` +
      `<path d="M${pentagon.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}Z" fill="${INK}" ${stroke()}/>` +
      `<path d="${spokes}" fill="none" ${stroke(9)}/>` +
      `<path d="M-300 -50H-215M-320 10H-225M-290 70H-215" fill="none" ${stroke(9)}/>`
    );
  }
  if (category === "screen") {
    const stripes = [0, 1, 2, 3]
      .map(
        (i) =>
          `<path d="M${-190 + i * 100} -150h50l-40 80h-50z" fill="${CREAM}" stroke="none"/>`
      )
      .join("");
    return (
      `<rect x="-190" y="-60" width="380" height="250" rx="18" fill="${CREAM}" ${stroke()}/>` +
      `<g transform="rotate(-9 -190 -60)"><rect x="-190" y="-150" width="380" height="84" rx="14" fill="${INK}" ${stroke()}/>${stripes}</g>` +
      `<path d="M-40 20V150L80 85Z" fill="${p.accent2}" ${stroke(9)}/>`
    );
  }
  if (category === "tech") {
    return (
      `<rect x="-210" y="-150" width="420" height="300" rx="24" fill="${CREAM}" ${stroke()}/>` +
      `<path d="M-210 -84H210" fill="none" ${stroke(9)}/>` +
      `<circle cx="-165" cy="-117" r="11" fill="${p.accent}" stroke="${INK}" stroke-width="5"/>` +
      `<circle cx="-125" cy="-117" r="11" fill="${p.accent2}" stroke="${INK}" stroke-width="5"/>` +
      `<circle cx="-85" cy="-117" r="11" fill="${p.blob}" stroke="${INK}" stroke-width="5"/>` +
      `<path d="M-150 -30L-95 12L-150 54" fill="none" ${stroke(15)}/>` +
      `<path d="M-55 56H25" fill="none" ${stroke(15)}/>` +
      `<path d="M-150 108H70" fill="none" ${stroke(8)} opacity=".35"/>`
    );
  }
  return (
    `<ellipse rx="265" ry="72" transform="rotate(-18)" fill="none" ${stroke(8)} stroke-dasharray="4 22"/>` +
    `<circle r="165" fill="${CREAM}" ${stroke()}/>` +
    `<ellipse rx="70" ry="165" fill="none" ${stroke(8)}/>` +
    `<ellipse rx="165" ry="58" fill="none" ${stroke(8)}/>` +
    `<path d="M-165 0H165M0 -165V165" fill="none" ${stroke(8)}/>` +
    `<circle cx="205" cy="-95" r="20" fill="${p.accent2}" ${stroke(8)}/>`
  );
}

/* A second picture per section, so a run of similar posts (seven Premier
 * League stories, say) does not become a wall of identical footballs. */
function altMotif(category: CoverCategory, p: (typeof PALETTES)[CoverCategory]) {
  if (category === "sports") {
    // trophy
    return (
      `<path d="M-110 -150H110V-40C110 40 50 92 0 92C-50 92-110 40-110 -40Z" fill="${CREAM}" ${stroke()}/>` +
      `<path d="M-110 -118H-172C-172 -48-140 -14-100 -14M110 -118H172C172 -48 140 -14 100 -14" fill="none" ${stroke()}/>` +
      `<path d="M0 -112L17 -72L60 -68L27 -40L37 4L0 -19L-37 4L-27 -40L-60 -68L-17 -72Z" fill="${p.accent2}" ${stroke(8)}/>` +
      `<rect x="-30" y="92" width="60" height="62" fill="${CREAM}" ${stroke()}/>` +
      `<rect x="-95" y="154" width="190" height="42" rx="10" fill="${p.blob}" ${stroke()}/>`
    );
  }
  if (category === "screen") {
    // television set
    return (
      `<path d="M-40 -122L-104 -196M40 -122L104 -196" fill="none" ${stroke()}/>` +
      `<rect x="-205" y="-122" width="410" height="272" rx="38" fill="${CREAM}" ${stroke()}/>` +
      `<rect x="-165" y="-84" width="262" height="196" rx="24" fill="${p.accent2}" ${stroke(9)}/>` +
      `<path d="M-60 -20V74L38 27Z" fill="${CREAM}" ${stroke(8)}/>` +
      `<circle cx="152" cy="-30" r="19" fill="${p.accent}" ${stroke(8)}/>` +
      `<circle cx="152" cy="34" r="19" fill="${p.blob}" ${stroke(8)}/>` +
      `<path d="M-150 150L-168 188M150 150L168 188" fill="none" ${stroke()}/>`
    );
  }
  if (category === "tech") {
    // circuit chip
    const pins = [-84, -28, 28, 84];
    const legs = pins
      .map(
        (v) =>
          `M${v} -130V-190M${v} 130V190M-130 ${v}H-190M130 ${v}H190`
      )
      .join("");
    return (
      `<path d="${legs}" fill="none" ${stroke()}/>` +
      `<rect x="-130" y="-130" width="260" height="260" rx="34" fill="${CREAM}" ${stroke()}/>` +
      `<rect x="-62" y="-62" width="124" height="124" rx="16" fill="${p.accent}" ${stroke(9)}/>` +
      `<path d="M-100 -100H-62M62 100H100M-100 100V62M100 -100V-62" fill="none" ${stroke(8)}/>` +
      `<circle cx="0" cy="0" r="18" fill="${CREAM}" ${stroke(7)}/>`
    );
  }
  // story: open book
  return (
    `<path d="M0 -105C-60 -150-150 -150-205 -118V122C-150 90-60 92 0 134Z" fill="${CREAM}" ${stroke()}/>` +
    `<path d="M0 -105C60 -150 150 -150 205 -118V122C150 90 60 92 0 134Z" fill="${CREAM}" ${stroke()}/>` +
    `<path d="M-160 -70C-120 -92-70 -88-30 -62M-160 -20C-120 -42-70 -38-30 -12M-160 30C-120 8-70 12-30 38M40 -62C80 -88 130 -92 160 -70M40 -12C80 -38 130 -42 160 -20" fill="none" ${stroke(7)}/>` +
    `<path d="M70 -128V-40L96 -62L122 -40V-136" fill="${p.accent2}" ${stroke(8)}/>`
  );
}

export function coverSvg(opts: { seed: string; category: CoverCategory }): string {
  const { seed, category } = opts;
  const p = PALETTES[category];
  const h = hash(seed);
  const rand = rng(h);
  const id = h.toString(36);

  const blob = blobPath(rand, 700 + rand() * 80, 380 + rand() * 60, 360);
  const tilt = Math.round((rand() - 0.5) * 16);
  const variant = rand() < 0.5 ? 0 : 1;
  const dots = {
    x: rand() > 0.5 ? 50 : 760,
    y: rand() > 0.5 ? 50 : 470,
  };
  const wave = squiggle(60, 600 - rand() * 120, 520, 20, 5);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
    `<defs>` +
    `<pattern id="d${id}" width="38" height="38" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="4" fill="${CREAM}" opacity=".55"/></pattern>` +
    `<filter id="f${id}" x="-12%" y="-12%" width="124%" height="124%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="${h % 97}" result="n"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="n" scale="7" result="w"/>` +
    `<feDropShadow in="w" dx="14" dy="14" stdDeviation="0" flood-color="${INK}"/>` +
    `</filter>` +
    `</defs>` +
    `<rect width="1200" height="750" fill="${p.bg}"/>` +
    `<path d="${blob}" fill="${p.blob}" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>` +
    `<rect x="${dots.x}" y="${dots.y}" width="390" height="230" fill="url(#d${id})"/>` +
    `<path d="${wave}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round" opacity=".85"/>` +
    confetti(rand, [CREAM, INK, p.accent, p.accent2, p.blob], { x: 740, y: 390, r: 300 }) +
    `<g filter="url(#f${id})"><g transform="translate(740 390) rotate(${tilt})">${motif(category, p, variant)}</g></g>` +
    `</svg>`
  );
}
