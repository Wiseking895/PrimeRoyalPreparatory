# PRPS — Architecture

**Project:** Prime Royal Preparatory School (P.R.P.S.) School Management System
**Motto:** Empowerment Through Education
**Phase:** 2 — Owner Portal + Authentication

## 1. System Overview

PRPS is a school management system split into two **independent applications**
plus a PostgreSQL database. The public website and the management dashboards
are served by the frontend; the backend owns all business logic and database
access. The two sides communicate **only** over HTTP.

```
┌────────────────────┐  HTTP (VITE_API_URL)   ┌────────────────────┐   ┌──────────────┐
│     frontend       │ ─────────────────────▶ │      backend       │─▶ │  PostgreSQL  │
│  React + Vite PWA  │                        │ Express + Prisma   │   │   (Prisma)   │
│  Tailwind, Router  │ ◀───────────────────── │ services / RBAC    │   │              │
└────────────────────┘                        └────────────────────┘   └──────────────┘
```

The backend is the single source of truth for authorization (RBAC), validation
and data. The frontend mirrors only the string constants it renders for display
(`frontend/src/auth/roles.ts`, `frontend/src/config/site.ts`).

## 2. Repository Layout

| Path | Package | Purpose |
| --- | --- | --- |
| `frontend/` | `@prps/frontend` | Public website + PWA + portal UI. React 19, TypeScript, Vite 6, Tailwind CSS v4, React Router 7. Owns its design-system docs. |
| `backend/` | `@prps/backend` | REST API + data layer. Node.js, Express 4, TypeScript, Prisma, PostgreSQL. Owns its database docs. |
| `docs/` | — | Repo-wide guides that apply to both applications (architecture, development). |

### Why this layout

- **Frontend and backend are separate applications** — no shared `src/`
  directory and no shared package. Each can be deployed, scaled and versioned
  independently (frontend → Vercel; backend → any Node-compatible host).
- **The data layer lives inside the backend** — Prisma schema, migrations and
  seed under `backend/prisma/`. The backend is the only process that ever
  touches PostgreSQL, so `DATABASE_URL` never reaches the frontend bundle.
- **Contracts are duplicated deliberately.** The two apps cannot import each
  other, so the shared constants/types that each side needs are kept as local
  modules (`backend/src/config/`, `backend/src/rbac/catalog.ts`,
  `frontend/src/config/site.ts`, `frontend/src/auth/roles.ts`). The backend
  catalog remains authoritative; the frontend keeps only display keys in sync.

## 3. Technology Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Frontend build | Vite (not Next.js) | The developer is not yet comfortable with Next.js. Vite + React Router covers SPA + PWA needs cleanly. |
| Styling | Tailwind CSS v4 | CSS-first config; brand tokens live in `src/styles/index.css`. |
| ORM | Prisma | First-class PostgreSQL support, migrations, seed, generated types. Lives under `backend/prisma/`. |
| API framework | Express 4 | Mature, widely known, simple middleware model. |
| Logging | pino + pino-http | Structured, fast, JSON logs; production friendly. |
| Validation | Zod | Request validation for auth/owner/staff routes (Phase 2). |
| Icons | lucide-react | Lightweight, tree-shakeable. |
| PWA | vite-plugin-pwa | Manifest, workbox precaching, installability, no offline sync in early phases. |
| Data fetching | fetch-based `lib/api.ts` | Thin typed HTTP client; TanStack Query may replace it in a later phase. |

## 4. Backend Structure

`backend/src/` keeps route → controller → service separation:

```
src/
  config/        env parsing, logger, constants, enums, API contracts/routes
  controllers/   thin HTTP adapters (parse request, call service, respond)
  routes/        express routers — NO business logic
  services/      business logic (auth, owner, staff, audit, RBAC catalog/guards)
  middleware/    security, errors, 404
  lib/           prisma client, jwt, password, api-response helpers
  rbac/          catalog.ts — the authoritative role/permission catalog
  utils/         AppError, asyncHandler
  app.ts         createApp() — wires everything (testable)
  server.ts      HTTP entry point
prisma/          schema.prisma, migrations, seed.ts
```

- Every response uses the `ApiResponse` envelope
  (`{ success, message, data?, errors? }`).
- Centralized error handling maps `AppError` to status codes; unexpected
  errors return a safe generic message and are logged.
- `GET /api/health` returns:
  `{ success: true, message: "PRPS API is running", data: {...} }`.
- Prisma database commands run from the `backend/` workspace:
  `db:generate`, `db:migrate`, `db:deploy`, `db:seed`, `db:studio`.

## 5. Frontend Structure

```
src/
  components/
    ui/            Button, Card, Container, Badge, SectionHeading, DynamicIcon
    common/        Header, Footer, Logo, ScrollToTop, PageHero, Reveal, NewsCard, GalleryCard
    forms/         ContactForm
    illustrations/ SVG scene system (KidFigure, scenes, hero) + brand palette
  layouts/         PublicLayout
  pages/           Home, About, Academics, Admissions, School Life, Gallery, News, Contact, 404
  sections/home/   Hero, Features, Statistics, Programs, Admission, Parent Portal, News, Gallery, Contact, CTA
  routes/          createBrowserRouter
  hooks/           useCountUp
  services/        site-content (content currently local; API-ready interface)
  data/            typed demo content
  config/          site + env config (site.ts also owns local SCHOOL constants)
  auth/            AuthContext, storage, ProtectedRoute, roles.ts (display keys)
  lib/             api (typed HTTP client), cn, date helpers
  types/           public site + portal types
  styles/          Tailwind entry + brand theme
```

### API access

All backend calls go through `frontend/src/lib/api.ts`, which uses
`import.meta.env.VITE_API_URL` as the base URL. In development this defaults to
`http://localhost:4000`; in production it must be set to the deployed backend
URL. `DATABASE_URL` and other backend secrets never appear in the frontend.

### Content architecture

All page content is consumed through `services/site-content.ts`. In Phase 1
the getters return local typed data (`data/`). When the API ships, only the
service internals change — the UI stays untouched.

### Illustration system

The public site has no external photo dependency. A reusable SVG illustration
system (`components/illustrations/`) provides the hero scene and all gallery,
programme and news imagery on the PRPS brand palette.

**Uniform rule:** pupils are always drawn in a SOLID CREAM shirt (body, collar,
neck and sleeves). The deep blue is a brand color, never a shirt color.

## 6. PWA Strategy

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`.
- Manifest: name, short_name, theme/background cream, standalone display,
  PNG icons (192/512 + maskable) generated from `public/logo.svg` via
  `@vite-pwa/assets-generator`.
- Workbox precaches built JS/CSS/html; `navigateFallback: /index.html` keeps
  deep links working offline.
- No offline data synchronization (documented in `development.md`).

## 7. Security Baseline

- `helmet` security headers; `x-powered-by` disabled.
- CORS restricted to configured `CLIENT_URL` origin(s).
- Basic global rate limiting.
- JSON body size limits.
- Centralized error handling — no stack traces leaked to clients.
- Phase 2: JWT auth (`require-auth`), per-route authorization
  (`require-permission`, RBAC guards), Zod request validation, audit logs,
  password hashing (bcrypt).
- Secrets only exist in the backend (`.env`, git-ignored); the frontend only
  ever receives `VITE_API_URL`.

## 8. Phases

See `README.md` for the roadmap. This architecture document must be updated
whenever a phase introduces a structural change (new package, module, or
cross-cutting concern).

## 9. Documented Assumptions

- No official PRPS logo/photo assets were available, so a branded placeholder
  emblem (`frontend/public/logo.svg`) and generated SVG illustrations are used.
  Replace when official assets are supplied.
- Contact details, fee amounts, staff/pupil names and GPS coordinates are
  intentionally NOT invented; placeholders are clearly labelled.
- Fonts use Google Fonts ("Plus Jakarta Sans") with robust system fallbacks so
  the PWA still renders correctly offline.