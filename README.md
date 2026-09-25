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

## Writing articles — the admin panel

The site embeds [Payload CMS](https://payloadcms.com): a full admin panel at
**`/admin`** with user accounts, drafts/publishing, a media library, and a rich
text editor. Publishing (or updating) an article re-renders the affected pages
right away; the home page, post list, feed and sitemap are refreshed too.

**AI drafting:** every post has an "AI prompt" field and a "Draft with AI on
save" checkbox. Describe the article you want, tick the box, save — the AI
writes a complete draft into the editor, which you can then edit and publish.

- Uses the NVIDIA API ([build.nvidia.com](https://build.nvidia.com), free);
  set `NVIDIA_API_KEY` on the server.
- Briefs may include URLs (e.g. "write about https://example.com"): the linked
  pages are fetched and handed to the model as source material, so it writes
  from the actual content instead of guessing.
- Default model is `openai/gpt-oss-20b`, raced two at a time against the rest
  of a built-in fallback list rather than tried one by one, so a single slow
  or retired (404/410) model doesn't stall the whole request. Override the
  first choice with `NVIDIA_MODEL` (pick one from
  `https://integrate.api.nvidia.com/v1/models`).
- Optional backstop: set `GEMINI_API_KEY` ([Google AI Studio](https://aistudio.google.com/apikey),
  free on the Flash tier) and Gemini is tried only if every NVIDIA attempt
  fails — no cost when NVIDIA is working. Works standalone too, without
  `NVIDIA_API_KEY`.
- Generation runs inside the save request. The Payload API route sets
  `maxDuration = 60`, the ceiling on Vercel's Hobby plan; without it saves
  time out after 10 s with a 504.

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

There is one **super-admin**, identified by email (`danielmwihoti@gmail.com`,
overridable with the `SUPER_ADMIN_EMAIL` environment variable). Everyone else
is a regular admin. Rules live in `src/lib/access.ts`.

| | Super-admin | Regular admin |
| --- | --- | --- |
| Add, delete or unlock admin users | yes | no |
| Edit user accounts | any | only their own (name, password) |
| Change an email address | any except its own | no |
| Create posts | yes | yes |
| See posts | all of them | their own and other regular admins', never the super-admin's or ownerless ones |
| Edit / delete posts | any | only their own |

- Every post records its **Owner (admin)** when created; it is set automatically
  and can't be changed. The Owner column in the post list shows each post's
  owner email, so admins can see who is working on what.
- Posts created before ownership was tracked have no owner and count as the
  super-admin's, so regular admins can't see them.
- Visitors only ever get *published* posts from the REST API (drafts and
  version history need a login). The public site itself is unaffected: it reads
  through Payload's Local API, which bypasses access rules.
- To add an admin, log in as the super-admin, open Users → Create New, set an
  email and password, and share the password securely.
- The super-admin's email can't be edited in the admin, since changing it would
  silently demote the account. If the super-admin's login email is ever
  different from the configured one, nobody can manage users: set
  `SUPER_ADMIN_EMAIL` in Vercel to that login email and redeploy.

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
| Can't create users, or your own older posts have disappeared, after a deploy | You are logged in with an email other than the super-admin's. Set `SUPER_ADMIN_EMAIL` to your login email and redeploy. |
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
| `PAYLOAD_SECRET` | Signs admin auth tokens; required in production |
| `SUPER_ADMIN_EMAIL` | Login email of the one account that can manage users and see every post (default `danielmwihoti@gmail.com`) |
| `DATABASE_URI` | Postgres connection string for the CMS; unset = local SQLite |
| `UPLOADTHING_TOKEN` | Media storage in production (UploadThing) |
| `NVIDIA_API_KEY` | Enables "Draft with AI" |
| `NVIDIA_MODEL` | Optional model override for AI drafting |
| `NVIDIA_ENDPOINT` | Optional OpenAI-compatible chat endpoint override (tests) |
| `GEMINI_API_KEY` | Optional backstop AI provider, used only if NVIDIA fails |
| `GEMINI_MODEL` | Optional model override for the Gemini backstop |

> [!IMPORTANT]
> As of **May 2026**, Hashnode's GraphQL API [requires a paid Pro plan](https://hashnode.com/changelog/2026-05-13-graphql-api-paid-access)
> on the publication — free API access (including reads) was retired. Until the
> publication is upgraded, all API requests are rejected and the site renders
> empty states ("No posts found"). The app handles this gracefully and will
> start showing content again as soon as API access is restored.

Support this project by starring. Any contributions are welcome!
