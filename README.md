# WorldView news blog

A headless news blog powered by [Hashnode](https://hashnode.com)'s GraphQL API and built with Next.js.

## Tech stack

- **Next.js 16** (App Router, React Server Components, ISR) with **React 19**
- **Tailwind CSS v4** with shadcn/ui-style components (Radix UI primitives)
- **Server Actions** for pagination and newsletter signup (no client-side data library)
- **TypeScript**, ESLint 9 (flat config), `lucide-react` icons, `next-themes` dark mode

## Features

- Statically generated pages with incremental revalidation (5 min)
- Paginated post list with a server-action-backed "Load more"
- Per-post SEO: Open Graph/Twitter metadata, canonical URLs, `NewsArticle` JSON-LD
- `sitemap.xml`, `robots.txt` and an RSS feed at `/feed.xml`
- Loading skeletons, error and not-found states
- Newsletter signup dialog wired to Hashnode's subscribe mutation

## Writing articles — the admin panel

The site embeds [Payload CMS](https://payloadcms.com): a full admin panel at
**`/admin`** with user accounts, drafts/publishing, a media library, and a rich
text editor. Articles published there appear on the site within ~5 minutes.

**AI drafting:** every post has an "AI prompt" field and a "Draft with AI on
save" checkbox. Describe the article you want, tick the box, save — Claude
writes a complete draft into the editor, which you can then edit and publish.
Requires `ANTHROPIC_API_KEY` on the server.

### Local development

Works out of the box: the CMS uses a local SQLite file (`worldview.db`).
Run `npm run dev`, open `http://localhost:3000/admin`, and create the first
admin user.

### Production (Vercel + Neon)

1. Create a free Postgres database at [neon.tech](https://neon.tech) and copy
   its connection string.
2. In Vercel, add the env vars: `DATABASE_URI` (the Neon string),
   `PAYLOAD_SECRET` (`openssl rand -hex 32`), and optionally
   `ANTHROPIC_API_KEY` for AI drafting.
3. One-time schema setup: run the dev server locally against the production
   database once — `DATABASE_URI=postgres://... npm run dev` — Payload pushes
   the schema automatically in dev mode. Then redeploy.
4. Uploaded images are stored on the server filesystem, which is ephemeral on
   Vercel — for durable media either use externally hosted image URLs or add
   the `@payloadcms/storage-vercel-blob` adapter.

The public site never depends on the CMS being up: if the database is missing
or unreachable, CMS posts are simply omitted and the rest of the content
(Hashnode + restored posts) still renders.

## Getting started

```bash
cp .env.example .env   # fill in your publication id
npm install
npm run dev
```

Environment variables (see `.env.example`):

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_HASHNODE_ENDPOINT` | Hashnode GraphQL endpoint |
| `NEXT_PUBLIC_HASHNODE_PUBLICATION_ID` | Your Hashnode publication id |
| `NEXT_PUBLIC_SITE_URL` | Optional canonical site URL used for SEO/sitemap/RSS |

> [!IMPORTANT]
> As of **May 2026**, Hashnode's GraphQL API [requires a paid Pro plan](https://hashnode.com/changelog/2026-05-13-graphql-api-paid-access)
> on the publication — free API access (including reads) was retired. Until the
> publication is upgraded, all API requests are rejected and the site renders
> empty states ("No posts found"). The app handles this gracefully and will
> start showing content again as soon as API access is restored.

Support this project by starring. Any contributions are welcome!
