/*
 * Exports every published post as a prompt→article training pair, for the
 * day the archive is big enough (roughly 100+ articles) to fine-tune a
 * model on the house voice instead of relying on per-request examples.
 *
 *   npm run export:training
 *
 * Needs the database: run against local dev as-is, or against production
 * with `npx vercel env pull .env.training --environment=production` and the
 * DATABASE_URI from that file (delete it afterwards). Writes two files to
 * ./training-data/ (gitignored):
 *
 *  - articles.jsonl        {"style","section","system","prompt","completion"}
 *                          per line — the generic shape most tuning services
 *                          (OpenAI-compatible, together.ai, …) accept with
 *                          little or no mapping.
 *  - articles.gemini.jsonl Gemini tuning format: {"systemInstruction",
 *                          "contents":[user, model]} per line, for
 *                          https://ai.google.dev/gemini-api/docs/model-tuning
 *
 * Posts with no AI prompt still export, with a synthesised brief, so
 * hand-written posts teach the model too.
 */

import fs from "node:fs";
import path from "node:path";
import { getPayload } from "payload";
import { convertLexicalToMarkdown, editorConfigFactory } from "@payloadcms/richtext-lexical";

const { default: config } = await import("../src/payload.config.ts");
const { articleStyle } = await import("../src/lib/article-styles.ts");

const payload = await getPayload({ config });
const editorConfig = await editorConfigFactory.default({ config: payload.config });

const { docs } = await payload.find({
  collection: "posts",
  where: { _status: { equals: "published" } },
  sort: "publishedAt",
  limit: 0,
  depth: 0,
  overrideAccess: true,
});

const SYSTEM =
  "You are a staff writer for WorldView, a news blog covering world news, sports, movies & TV, and tech. " +
  "Write a complete, publishable article in markdown from the brief: first line a level-1 heading (# Title), " +
  "then the body with ## subheadings and short paragraphs. Output only the article.";

const pairs = [];
for (const doc of docs) {
  let markdown = "";
  try {
    markdown = convertLexicalToMarkdown({ data: doc.content, editorConfig }).trim();
  } catch {
    continue;
  }
  if (!markdown || markdown.length < 300) continue; // stubs teach nothing

  const style = articleStyle(doc.aiStyle);
  const brief =
    (typeof doc.aiPrompt === "string" && doc.aiPrompt.trim()) ||
    `Write an article titled "${doc.title}".`;
  pairs.push({
    style: style?.id ?? null,
    section: doc.section ?? null,
    system: style ? `${SYSTEM} ${style.writer}` : SYSTEM,
    prompt: `Brief: ${brief}`,
    completion: `# ${doc.title}\n\n${markdown}`,
  });
}

const outDir = path.resolve(import.meta.dirname, "..", "training-data");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "articles.jsonl"),
  pairs.map((p) => JSON.stringify(p)).join("\n") + "\n"
);
fs.writeFileSync(
  path.join(outDir, "articles.gemini.jsonl"),
  pairs
    .map((p) =>
      JSON.stringify({
        systemInstruction: { parts: [{ text: p.system }] },
        contents: [
          { role: "user", parts: [{ text: p.prompt }] },
          { role: "model", parts: [{ text: p.completion }] },
        ],
      })
    )
    .join("\n") + "\n"
);

const byStyle = pairs.reduce((acc, p) => {
  const key = p.style ?? "(no style)";
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});
console.log(`Exported ${pairs.length} article(s) to ${outDir}`);
for (const [style, count] of Object.entries(byStyle)) console.log(`  ${style}: ${count}`);
if (pairs.length < 100) {
  console.log(
    `Note: ~100+ examples are needed before fine-tuning is worth it; at ${pairs.length} ` +
      "the per-request style examples (the Style dropdown) will serve better."
  );
}
process.exit(0);
