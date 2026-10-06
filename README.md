# WorldView news blog

A news blog built with Next.js. Articles come from two sources: the built-in
[Payload CMS](https://payloadcms.com) admin panel at `/admin` (with AI-assisted
drafting) and, optionally, a [Hashnode](https://hashnode.com) publication.

## Tech stack

- **Next.js 16** (App Router, React Server Components, ISR) with **React 19**
- **Tailwind CSS v4** with shadcn/ui-style components (Radix UI primitives)
- **Server Actions** for pagination and newsletter signup (no client-side data library)
- **TypeScript**, ESLint 9 (flat config), `lucide-react` icons, `next-themes` dark mode

## Features

- Statically generated pages with incremental revalidation (5 min), plus
  on-demand revalidation so articles published in the admin appear immediately
- Paginated post list with a server-action-backed "Load more"
- Per-post SEO: Open Graph/Twitter metadata, canonical URLs, `NewsArticle` JSON-LD
- `sitemap.xml`, `robots.txt` and an RSS feed at `/feed.xml`
- Loading skeletons, error and not-found states
- Newsletter signup dialog wired to Hashnode's subscribe mutation

## Look and feel

The public site is styled like a field notebook: warm paper with a faint grain,
ink-black outlines, hard offset "sticker" shadows, wobbly hand-drawn marks and a
handwritten margin voice, with smooth scroll-driven motion on top. The Payload
admin is a separate route group and is not affected.

- **Typefaces** (self-hosted via `next/font`): Fraunces for headlines, Newsreader
  for article text, Bricolage Grotesque for interface text, Caveat for the
  handwritten notes.
- **Reader themes**: Paper, Sepia, Moss, Ink and Blueprint, plus "Device" to
  follow the system light/dark setting. Readers also pick a text size and
  serif/sans from the **Reader** button in the header; choices are stored in
  `localStorage` and restored before first paint. A theme is just a block of HSL
  tokens in `src/app/globals.css` (`[data-theme='…']`): to add one, copy a block,
  add its id to `themes` in `src/app/(site)/layout.tsx` and to `THEMES` in
  `src/components/reader-settings.tsx`. Every text/background pair in every theme
  meets WCAG AA (4.5:1) — re-check if you change colours.
- **Covers**: posts without an uploaded image get a drawn illustration generated
  from the post's slug and section (`src/lib/cover-art.ts`), so they are always
  the same picture and never an empty box. The covers for the posts bundled in
  `src/content/posts.ts` are the same art saved as files:
  `node scripts/generate-covers.mjs` regenerates `public/covers/<version>/`.
  Browsers, the CDN and Next's image optimiser cache by URL, so after redrawing
  the art bump `COVER_VERSION` in `src/lib/cover-version.ts` before regenerating.
- **Sections** (Sports, Movies & TV, Tech, Stories) are derived from the author,
  with a title-keyword fallback: see `src/lib/category.ts`.
- **Motion**: put `data-reveal` on anything that should fade/slide in as it scrolls
  into view (variants `left`, `right`, `pop`, `fade`; `--reveal-delay` staggers);
  article paragraphs do it automatically. First-screen content uses `data-enter`,
  which is plain CSS and so never waits for JavaScript. Everything respects
  `prefers-reduced-motion`, and without JavaScript the page is simply static.

## Writing articles — the admin panel

The site embeds [Payload CMS](https://payloadcms.com): a full admin panel at
**`/admin`** with user accounts, drafts/publishing, a media library, and a rich
text editor. Publishing (or updating) an article re-renders the affected pages
right away; the home page, post list, feed and sitemap are refreshed too.

**AI drafting:** every post has an "AI prompt" field and a **Generate draft**
button under it. Describe the article you want and click it: the panel shows
each stage as it happens (reading linked pages, writing, the reviewer's score
and note, each revision, with a timer), then puts the finished draft in the
editor. Nothing is saved until you click Save Draft or Publish. (API callers
can still set `draftWithAI: true` on save instead.)

- Uses the NVIDIA API ([build.nvidia.com](https://build.nvidia.com), free);
  set `NVIDIA_API_KEY` on the server.
- Briefs may include URLs (e.g. "write about https://example.com"): the linked
  pages are fetched and handed to the model as source material, so it writes
  from the actual content instead of guessing. Only public web pages are
  fetched (private, loopback and cloud-metadata addresses are refused, also
  after redirects), up to 2 MB each.
- Default model is `openai/gpt-oss-20b`, raced two at a time against the rest
  of a built-in fallback list rather than tried one by one, so a single slow
  or retired (404/410) model doesn't stall the whole request. Override the
  first choice with `NVIDIA_MODEL` (pick one from
  `https://integrate.api.nvidia.com/v1/models`).
- Optional backstop: set `GEMINI_API_KEY` ([Google AI Studio](https://aistudio.google.com/apikey),
  free on the Flash tier) and Gemini is tried only if every NVIDIA attempt
  fails — no cost when NVIDIA is working. Works standalone too, without
  `NVIDIA_API_KEY`.
- The Payload API route sets `maxDuration = 60`, the ceiling on Vercel's
  Hobby plan; drafting streams its progress inside that one request.
- **Self-review loop:** every draft and every chat-assistant revision is
  checked by a *different* model acting as an editor (a fixed reviewer: Gemini
  when configured, otherwise Nemotron, or whatever `AI_JUDGE_MODEL` says; it is
  never the model that wrote the draft). It scores the draft and says whether
  it's ready. If not, the writer gets another turn, using the editor's own
  words as instructions, up to 3 rounds. Everything shares one time budget so
  it can never exceed Vercel's function limit; if time runs low the loop stops
  with the best draft so far. Code in `src/lib/article-loop.ts`.
- **What the review concluded** is stored on the post (sidebar): rounds, the
  result (approved / not approved after 3 revisions / out of time / reviewer
  unavailable / revision failed), the reviewer's last score, every round's
  note, and which models wrote and reviewed it. If the reviewer can't be
  reached, the draft still goes through but is marked as not reviewed. These
  fields can't be edited through the admin or the API; only the AI flow sets
  them.
- Limits: the AI endpoints only work on posts you can edit, one request at a
  time per admin, and `AI_RATE_LIMIT` (default 20) per 10 minutes.

**AI assistant (chat):** below the content editor every post has an "AI
assistant" panel. Chat with the model about the current draft — "fix the
typos", "make the second section shorter", "rewrite the headline", or ask a
question about it. Whenever it proposes changes it returns the complete
revised article; use **Preview** to read it and **Apply to editor** to replace
the editor content (and the title, if empty). Nothing is saved until you click
Save Draft or Publish, so you stay in control of what goes live. The panel
talks to `POST /api/posts/ai-chat` (logged-in admins only) and uses the same
model configuration as drafting.

**Media:** cover images are uploaded through the admin. Locally they land in
`./media`; in production they are stored in [UploadThing](https://uploadthing.com)
and served straight from its CDN (public URLs), so the site never proxies
image bytes through a serverless function.

### Admin accounts and permissions

Each user has a **role**: *Super-admin* or *Admin* (the dropdown in the user's
sidebar). Only a super-admin can change roles. The first account created on a
fresh database becomes the super-admin automatically. Rules live in
`src/lib/access.ts`.

| | Super-admin | Regular admin |
| --- | --- | --- |
| Add, delete or unlock admin users | yes | no |
| Edit user accounts | any | only their own (name, password) |
| Change an email address or role | any | no |
| Create posts | yes | yes |
| See posts | all of them | their own and other regular admins', never a super-admin's or ownerless ones |
| Edit / delete posts | any | only their own |
| Change a post's Owner | yes (dropdown on the post) | no |

- Every post records its **Owner (admin)** when created; it is set
  automatically, and only the super-admin can change it (a dropdown on the
  post). The Owner column in the post list shows each post's owner email, so
  admins can see who is working on what.
- Posts created before ownership was tracked have no owner and count as the
  super-admin's, so regular admins can't see them, **including ones a regular
  admin wrote themselves**. To give one back, open it as the super-admin, pick
  the admin in the Owner dropdown and click Save Draft or Publish changes (the
  change applies to the live post either way).
- Visitors only ever get *published* posts from the REST API (drafts and
  version history need a login). The public site itself is unaffected: it reads
  through Payload's Local API, which bypasses access rules.
- To add an admin, log in as the super-admin, open Users → Create New, set an
  email and password, and share the password securely.
- To make someone a super-admin, open their user as a super-admin and change
  **Role**. The last super-admin can't be demoted or deleted.
- Databases from before roles existed have no super-admin. On startup the app
  promotes the account whose email is `SUPER_ADMIN_EMAIL` (if set), otherwise
  the oldest account, and logs which one. This runs only while no super-admin
  exists, so it can't be used to take over a working site.

### Local development

Works out of the box: the CMS uses a local SQLite file (`worldview.db`).
Run `npm run dev`, open `http://localhost:3000/admin`, and create the first
admin user.

### Production (Vercel + Neon + UploadThing)

1. **Database** — create a free Postgres database at [neon.tech](https://neon.tech)
   and copy its connection string.
2. **Media** — create a free app at [uploadthing.com](https://uploadthing.com)
   (no card needed) and copy its token.
3. **Env vars** — in Vercel → Settings → Environment Variables, add for
   Production *and* Preview:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URI` | the Neon connection string |
   | `PAYLOAD_SECRET` | any long random string (`openssl rand -hex 32`) |
   | `UPLOADTHING_TOKEN` | the UploadThing app token |
   | `NVIDIA_API_KEY` | optional, enables AI drafting |
   | `NVIDIA_MODEL` | optional, overrides the default model |

4. **Schema** — the first time, run the dev server locally against the
   production database once (`DATABASE_URI=postgres://... npm run dev`, open
   `/admin`, stop it). Payload pushes the schema automatically in dev mode.
   The two columns the UploadThing adapter needs on `media` are also added
   idempotently on startup (see `onInit` in `src/payload.config.ts`), so a
   deploy alone repairs a database that predates the adapter.
5. **Deploy** — see below.

If any of `DATABASE_URI` / `PAYLOAD_SECRET` are missing, `/admin` shows a setup
notice instead of an error. If `UPLOADTHING_TOKEN` is missing on Vercel, saving
an image fails with a message that names the variable (Vercel's filesystem is
read-only, so there is no local fallback there).

The public site never depends on the CMS being up: if the database is missing
or unreachable, CMS posts are simply omitted and the rest of the content
(Hashnode + restored posts) still renders.

### Deploying

Production is the `main` branch. Merging a PR does **not** currently trigger a
Vercel build (the GitHub integration is connected but produces no
deployments), so after merging deploy from a checkout of `main`:

```bash
git checkout main && git pull
npx vercel deploy --prod
```

Do not use the dashboard's **Redeploy** action to pick up new code: it rebuilds
the exact commit of the deployment you clicked, not `main`. Use
**Create Deployment** → branch `main` instead, or the CLI above. To restore
automatic deploys, disconnect and reconnect the repository under Vercel →
Settings → Git.

Every deployment keeps its own `world-view-<hash>-….vercel.app` URL running the
code it was built with. Always test on the production alias
(`world-view-pi.vercel.app`), not on a deployment-specific URL.

The Vercel project should run **Node.js 22 or newer** (Settings → General →
Node.js Version); Vercel stops building on Node 20 in October 2026.

### Troubleshooting

Read the runtime logs first (Vercel → Logs, or `npx vercel logs
world-view-pi.vercel.app`); the admin only shows "Something went wrong".

| Log message | Meaning |
| --- | --- |
| `Collections with uploads enabled require a storage adapter` / `ENOENT: mkdir 'media'` | `UPLOADTHING_TOKEN` is not set in the running deployment. Add it and deploy. |
| `column "_key" does not exist` | Production schema predates the UploadThing adapter and the startup repair has not run yet. Deploy the current `main`. |
| `Vercel Runtime Timeout Error: Task timed out after 10 seconds` on `PATCH /api/posts/…` | AI drafting exceeded the default function limit; the current code sets `maxDuration = 60`. Deploy the current `main`. |
| `The model '…' has reached its end of life` | NVIDIA retired the model. The fallback list handles it; if all fail, set `NVIDIA_MODEL`. |
| A regular admin can't find or edit a post they wrote earlier | It predates ownership tracking, so it has no owner. As the super-admin, open it and set the Owner dropdown to that admin, then save. |
| Can't create users, or your own older posts have disappeared, after a deploy | Your account isn't a super-admin. Ask a super-admin to change your Role, or, if nobody is, see "Admin accounts and permissions" above. |
| An article or cover doesn't show up right after publishing | The cached page is being re-rendered; reload once. If it never appears, check that the post's `_status` is `published` (not just "Save draft"). |

## Getting started

```bash
cp .env.example .env   # optional: fill in what you have
npm install
npm run dev
```

Environment variables (see `.env.example`). Everything is optional for local
development; the CMS falls back to SQLite and the Hashnode integration simply
stays off when unconfigured.

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_HASHNODE_ENDPOINT` | Hashnode GraphQL endpoint (optional) |
| `NEXT_PUBLIC_HASHNODE_PUBLICATION_ID` | Your Hashnode publication id (optional) |
| `NEXT_PUBLIC_HASHNODE_RSS_URL` | Public RSS feed used as a fallback when the GraphQL API is unavailable |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL used for SEO/sitemap/RSS |
| `PAYLOAD_SECRET` | Signs admin auth tokens; required in production (the CMS refuses to start without it) |
| `SUPER_ADMIN_EMAIL` | Optional: which existing account to promote if the database has no super-admin yet (otherwise the oldest account) |
| `DATABASE_URI` | Postgres connection string for the CMS; unset = local SQLite |
| `UPLOADTHING_TOKEN` | Media storage in production (UploadThing) |
| `NVIDIA_API_KEY` | Enables "Generate draft" and the AI assistant |
| `NVIDIA_MODEL` | Optional model override for AI drafting |
| `NVIDIA_ENDPOINT` | Optional OpenAI-compatible chat endpoint override (tests) |
| `GEMINI_API_KEY` | Optional backstop AI provider, used only if NVIDIA fails |
| `GEMINI_MODEL` | Optional model override for the Gemini backstop |
| `AI_JUDGE_MODEL` | Optional fixed reviewer for the self-review loop: an NVIDIA model id, or `gemini` / `gemini:<model>`. Default: Gemini when `GEMINI_API_KEY` is set, otherwise `nvidia/nemotron-3-super-120b-a12b`. Never the model that wrote the draft. |
| `AI_RATE_LIMIT` | Optional: AI requests each admin may start per 10 minutes (default 20; one at a time) |

> [!IMPORTANT]
> As of **May 2026**, Hashnode's GraphQL API [requires a paid Pro plan](https://hashnode.com/changelog/2026-05-13-graphql-api-paid-access)
> on the publication — free API access (including reads) was retired. Until the
> publication is upgraded, all API requests are rejected and the site renders
> empty states ("No posts found"). The app handles this gracefully and will
> start showing content again as soon as API access is restored.

Support this project by starring. Any contributions are welcome!
