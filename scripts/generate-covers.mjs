// Regenerates public/covers/<version>/*.svg for the posts in src/content/posts.ts using
// the same engine that draws covers for posts without one (src/lib/cover-art.ts).
// Run: node scripts/generate-covers.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { localPosts } from "../src/content/posts.ts";
import { categoryFor } from "../src/lib/category.ts";
import { coverSvg } from "../src/lib/cover-art.ts";
import { COVER_VERSION } from "../src/lib/cover-version.ts";

mkdirSync(new URL(`../public/covers/${COVER_VERSION}/`, import.meta.url), { recursive: true });

for (const post of localPosts) {
  if (!post.cover) continue;
  const category = categoryFor({ title: post.title, author: { name: post.author } }).id;
  const svg = coverSvg({ seed: post.slug, category });
  const file = new URL(`../public/covers/${COVER_VERSION}/${basename(post.cover)}`, import.meta.url);
  writeFileSync(file, svg + "\n");
  console.log(`${category.padEnd(7)} ${basename(post.cover)} (${svg.length} bytes)`);
}
