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
