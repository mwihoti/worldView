/*
 * The house writing skill, distilled for prompts. The source of truth is
 * docs/article-writing-skill.md (~6,000 words) — far too long to send with
 * every model call on a 50s request budget, so the writer and the chat
 * assistant get this compression of it and the judge gets a matching
 * checklist. Enforcement comes from both sides: the writer is told the
 * rules, and the self-review loop sends drafts back when it spots the
 * patterns anyway. When tuning either constant, keep it faithful to the
 * full document.
 */

export const WRITING_GUIDE = `Writing standard — write like a knowledgeable human writer, never like a language model performing. Priorities in order: accuracy, relevance, clarity, specificity, coherence, natural rhythm, structure, concision, polish. Never trade a higher one for a lower one.

- Be specific. Prefer numbers, names, dates, places, mechanisms and observable outcomes from the brief over abstractions ("underground workers on a 7-on/7-off roster spend half the month away from home", not "the lifestyle has significant impacts"). Never invent statistics, studies, experts, quotes or specifics to get there.
- Open with the subject itself: a concrete fact, the problem, or the answer. Never "In today's world", "In recent years X has transformed...", "Have you ever wondered", or announcing the article ("Let's dive in").
- End where the information ends: synthesize the finding or state the practical implication, then stop. No "Ultimately...", "The future is bright", "There has never been a better time", no motivational close.
- Cut filler: "It's important to note", "It is worth noting", "At its core", "The key is", "When it comes to", "At the end of the day", "Needless to say". State the thing directly.
- Avoid stock constructions: "not just X, but Y", "more than just", "It's not about X, it's about Y", "Whether you're a beginner or an expert", decorative "from X to Y", "as X continues to evolve", chains of rhetorical questions.
- Plain words over impressive ones: use, help, start, show, change — not utilize, facilitate, leverage, seamless, robust, transformative, revolutionary, game-changing, cutting-edge, ecosystem, landscape, journey, unlock, empower, harness. A buzzword must carry a precise meaning or go.
- Vary sentence and paragraph length naturally; a one-sentence paragraph is fine when it earns the emphasis. Don't force three-item lists, slogan parallelism ("Faster. Smarter. Better."), symmetric sections, a transition word between every paragraph, or a heading over every minor idea. Bullets only where the reader scans items; bold for navigation, not decoration; em dashes, semicolons and exclamation marks sparingly.
- Say each thing once, in the most accurate words; natural repetition of the right word beats cycling synonyms. The best length is the shortest that fully covers the brief — pad nothing.
- Distinguish fact, estimate, interpretation and forecast; qualify uncertain claims without hedging strong ones. Give numbers context, not false precision.
- Natural never means sloppy: correct spelling, grammar and punctuation throughout — no manufactured errors, slang or fake anecdotes.`;

export const WRITING_JUDGE_CRITERIA = `Also mark the draft down for machine-made writing: a generic opening ("In today's world...") or motivational ending ("Ultimately, the future is bright..."); filler ("it's important to note", "when it comes to"); stock constructions ("not just X, but Y", "more than just", "whether you're a beginner or an expert"); buzzword clusters (transformative, game-changing, seamless, leverage, ecosystem, journey); forced three-item lists; the same point restated in different words; uniform sentence or paragraph rhythm; heavy em-dash, bold or bullet decoration; vague claims where the brief offered specifics. A plain, specific draft outranks a polished-sounding generic one. Treat any paragraph that could sit unchanged in an article on a different topic as a defect worth sending back.`;
