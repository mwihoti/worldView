import type { Payload } from "payload";
import { convertLexicalToMarkdown, editorConfigFactory } from "@payloadcms/richtext-lexical";
import type { SerializedEditorState } from "lexical";

/*
 * Article styles: what kind of piece the AI should write. Each style adds
 * its own instructions to the writer's system prompt and its own criteria
 * to the judge's, so a match report is written — and reviewed — as a match
 * report, not as a generic news story.
 *
 * The model is not fine-tuned on these; the "training" is done per request:
 * the style's instructions plus up to two of the site's own published
 * articles in the same style (fetchStyleExamples below) go into the prompt
 * as examples of the house voice. As more articles are published, the
 * examples get better on their own — and they double as the dataset a real
 * fine-tune would start from (scripts/export-training-data.mjs).
 */

export type ArticleStyle = {
  id: string;
  label: string;
  /* Shown under the Style dropdown in the admin. */
  hint: string;
  /* Appended to the writer's system prompt. */
  writer: string;
  /* Appended to the judge's scoring criteria. */
  judge: string;
};

export const ARTICLE_STYLES: ArticleStyle[] = [
  {
    id: "news-report",
    label: "News report",
    hint: "Straight news: what happened, who, when, why it matters.",
    writer:
      "Write it as a straight news report: a lead paragraph that answers who/what/when/where up front, " +
      "then detail in descending order of importance. Neutral, factual tone; attribute claims to the " +
      "brief's sources; no opinion and no rhetorical questions.",
    judge:
      "Also judge it as a news report: does the first paragraph deliver the core facts, is the tone " +
      "neutral, is everything attributed rather than asserted?",
  },
  {
    id: "feature",
    label: "Feature story",
    hint: "A longer read with scene-setting, people and narrative arc.",
    writer:
      "Write it as a feature: open with a scene or a person rather than the news point, build a " +
      "narrative arc, and weave the facts through the story. Longer paragraphs are fine; end with a " +
      "closing image or thought that echoes the opening.",
    judge:
      "Also judge it as a feature: does it open with a scene rather than a summary, does the narrative " +
      "carry through, does the ending land?",
  },
  {
    id: "match-report",
    label: "Match report",
    hint: "Sports: result first, then how the game unfolded.",
    writer:
      "Write it as a match report: the result and its significance in the first paragraph, then the " +
      "story of the game in order — key moments, turning points, standout performances — and close " +
      "with what the result means for what comes next. Use the score and player names from the brief " +
      "only; never invent match events.",
    judge:
      "Also judge it as a match report: is the result up top, do the key moments come in a clear " +
      "order, is every match event supported by the brief?",
  },
  {
    id: "review",
    label: "Review",
    hint: "Movies, TV, tech: a verdict with reasons, not a summary.",
    writer:
      "Write it as a review: a clear point of view from the first paragraph, judgments backed by " +
      "specifics, a balanced look at weaknesses, and a verdict at the end that tells the reader " +
      "whether it is worth their time or money. Describe, don't spoil: no plot twists or endings.",
    judge:
      "Also judge it as a review: is there an actual verdict, are judgments backed by specifics " +
      "rather than adjectives, does it avoid spoilers?",
  },
  {
    id: "explainer",
    label: "Explainer",
    hint: "Breaks a topic down for someone new to it.",
    writer:
      "Write it as an explainer for a smart reader who knows nothing about the topic: start from the " +
      "question a newcomer would ask, define terms the first time they appear, use short sections " +
      "with plain-question subheadings (## What is …? ## Why does it matter?), and prefer concrete " +
      "examples over abstractions.",
    judge:
      "Also judge it as an explainer: could a newcomer follow it start to finish, are terms defined " +
      "before they are leaned on, do the subheadings ask the reader's own questions?",
  },
  {
    id: "opinion",
    label: "Opinion",
    hint: "An argued position in the writer's voice.",
    writer:
      "Write it as an opinion piece: one clear thesis stated early, argued step by step, with the " +
      "strongest counter-argument acknowledged and answered rather than ignored. First person is " +
      "allowed; hedging is not — take the position the brief asks for and defend it.",
    judge:
      "Also judge it as an opinion piece: is there one clear thesis, is it actually argued rather " +
      "than restated, is a real counter-argument addressed?",
  },
  {
    id: "listicle",
    label: "List article",
    hint: "A ranked or themed list with a short case for each entry.",
    writer:
      "Write it as a list article: a short intro saying what the list is and how it was chosen, then " +
      "numbered ## subheadings, one per entry, each with two or three sentences making the case for " +
      "that entry. Keep entries parallel in shape and end with a one-paragraph wrap-up.",
    judge:
      "Also judge it as a list article: is each entry its own subheading with a real case made for " +
      "it, are the entries parallel, does the intro say how the list was chosen?",
  },
];

export function articleStyle(id: string | null | undefined): ArticleStyle | undefined {
  return ARTICLE_STYLES.find((style) => style.id === id);
}

/* Keeps two examples plus the brief comfortably inside the models' context
 * and the request's time budget. */
const EXAMPLE_MAX_CHARS = 2_500;
const EXAMPLE_COUNT = 2;

export function exampleBlock(examples: string[]): string {
  if (examples.length === 0) return "";
  return (
    "\n\nHere are published WorldView articles in this style. Match their voice, " +
    "structure and pacing — never their topic or facts:\n\n" +
    examples
      .map((text) => `<example>\n${text.slice(0, EXAMPLE_MAX_CHARS)}\n</example>`)
      .join("\n\n")
  );
}

/*
 * The site's own most recent published articles in the given style, as
 * markdown, for use as few-shot examples. Read with overrideAccess so an
 * admin drafting a post can learn from colleagues' published work too (the
 * posts are public on the site anyway).
 */
export async function fetchStyleExamples(
  payload: Payload,
  styleId: string,
  excludePostId?: string | number | null
): Promise<string[]> {
  try {
    const { docs } = await payload.find({
      collection: "posts",
      where: {
        and: [
          { aiStyle: { equals: styleId } },
          { _status: { equals: "published" } },
          ...(excludePostId != null ? [{ id: { not_equals: excludePostId } }] : []),
        ],
      },
      sort: "-publishedAt",
      limit: EXAMPLE_COUNT,
      depth: 0,
      overrideAccess: true,
    });
    const editorConfig = await editorConfigFactory.default({ config: payload.config });
    return docs
      .map((doc) => {
        try {
          const markdown = convertLexicalToMarkdown({
            data: doc.content as SerializedEditorState,
            editorConfig,
          }).trim();
          return markdown ? `# ${doc.title}\n\n${markdown}` : null;
        } catch {
          return null;
        }
      })
      .filter((text): text is string => text !== null);
  } catch {
    // Examples are a bonus, never a blocker — a query failure (e.g. the
    // ai_style column not existing yet) just means drafting without them.
    return [];
  }
}
