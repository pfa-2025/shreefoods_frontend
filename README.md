# Shree Foods website

Next.js 16 (App Router, Cache Components), React 19, TypeScript (strict), Tailwind v4, Motion. Public site (menu, cart, checkout, order tracking, reviews) and the admin (`/admin`).

It talks to the Shree Foods API (`shreefoods_backend`); see that repository's `docs/deployment.md` for hosting and environment variables.

## Run locally

```bash
npm install
cp .env.example .env.local     # API address, REVALIDATE_SECRET (same value as the API)
npm run dev                    # http://localhost:3000 (start the API first)
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run build` / `npm start` | production build and server |
| `npm run typecheck` / `npm run lint` | static checks |
| `npm test` | unit tests (Vitest) |
| `npm run e2e` | browser tests (Playwright). Needs the API and a production build running; create the test accounts first with `npm run e2e:data -- prepare` in the backend and remove them afterwards with `cleanup`. |

Images uploaded in the admin live in Cloudflare R2; set `R2_PUBLIC_URL` (same as the API) **before building** so the site can optimise them.
