# mls-v3-frontend

GTA real estate portal frontend. Next.js App Router app backed by a Django/DRF API.

## Setup

```bash
cp .env.example .env.local
# set API_BASE_URL / NEXT_PUBLIC_API_BASE_URL to your backend origin
npm install
npm run dev
```

The app renders without a backend — data-backed sections degrade to an explicit
unavailable state rather than inventing placeholder numbers.

## Architecture

```
app/
  (site)/          Pages with navbar + footer chrome
  (map)/           Full-bleed map layout (no footer)
  (studio)/        Staff / editorial console
  api/             Route handlers (auth cookies, proxies, forms)
components/
  ui/              Shared primitives
  layout/          Navbar, Footer, Logo
  property/        Listing cards, gallery, filters, inquiry
  providers/       Auth, watched, WhatsApp, etc.
lib/
  api/             Typed client + domain modules + mappers
  types/           backend.ts (API shapes) / domain.ts (UI shapes)
  queries/         TanStack Query helpers
  site/            Homepage / chrome CMS helpers
```

**Key conventions**

- **`lib/api/mappers.ts` is the only place that knows RESO field names.** Components
  consume domain types; a backend rename is a one-file fix.
- **DRF serializes `DecimalField` as a string** — money and area fields are typed
  `string | null` in `backend.ts` and converted at the mapper boundary.
- **Filters live in the URL**, so searches are shareable and the back button works.
- **JWTs live in httpOnly cookies**, set by `app/api/auth/*` route handlers. Page
  scripts never see a token; Server Components resolve the user during render.

## Design system

Tokens live in `app/globals.css` under `@theme` (navy, gold, ink, surface, type scale).

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build
npm run lint    # eslint
npm test        # vitest
```
