# PRPS — Architecture

**Project:** Prime Royal Preparatory School (P.R.P.S.) School Management System
**Motto:** Empowerment Through Education
**Phase:** 1 — Foundation + Public Website

## 1. System Overview

PRPS is a school management system built as a monorepo of four focused
packages. The public website is live in Phase 1; management dashboards,
authentication, academics, fees and reporting arrive in later phases.

```
┌────────────────────┐      ┌────────────────────┐      ┌──────────────┐
│     frontend       │      │      backend       │      │   database   │
│  React + Vite PWA  │ ───▶ │  Express (REST)    │ ───▶ │  PostgreSQL  │
│  Tailwind, Router  │      │  services / repos  │      │  Prisma ORM  │
└────────────────────┘      └────────────────────┘      └──────────────┘
        │                            │
        └────────────┬───────────────┘
                     ▼
        ┌──────────────────────────┐
        │       @prps/shared       │  Types, enums, constants, API contracts
        └──────────────────────────┘
```

## 2. Repository Layout

| Path | Package | Purpose |
| --- | --- | --- |
| `frontend/` | `@prps/frontend` | Public website + PWA. React 19, TypeScript, Vite 6, Tailwind CSS v4, React Router 7. |
| `backend/` | `@prps/backend` | REST API. Node.js, Express 4, TypeScript, helmet, cors, pino, rate limiting. |
| `database/` | `@prps/database` | Data layer. Prisma ORM, migrations, seed. |
| `shared/` | `@prps/shared` | Contracts shared by every layer. Built with tsup, consumed as ESM. |
| `docs/` | — | Architecture, design system, database, development guides. |
| `scripts/` | — | Small automation (env bootstrap, future tooling). |

### Why this layout

- **Frontend and backend are separate applications** — no shared `src/`
  directory. Each can be deployed, scaled and versioned independently.
- **The data layer is a separate package** so the schema, migrations and seed
  live close to the ORM and far from HTTP concerns.
- **`shared` eliminates drift** between API responses and frontend types; the
  health route constant is a single source of truth used by both sides.

## 3. Technology Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Frontend build | Vite (not Next.js) | The developer is not yet comfortable with Next.js. Vite + React Router covers SPA + PWA needs cleanly. |
| Styling | Tailwind CSS v4 | CSS-first config; brand tokens live in `src/styles/index.css`. |
| ORM | Prisma | First-class PostgreSQL support, migrations, seed, generated types. Used consistently from Phase 1 onward. |
| API framework | Express 4 | Mature, widely known, simple middleware model. |
| Logging | pino + pino-http | Structured, fast, JSON logs; production friendly. |
| Validation | Zod (planned) | Introduced in a later phase when request schemas appear (auth/fees). |
| Icons | lucide-react | Lightweight, tree-shakeable. |
| PWA | vite-plugin-pwa | Manifest, workbox precaching, installability, no offline sync in early phases. |
| Forms | React Hook Form + Zod (planned) | Deferred until real forms ship (Phase 2+). Phase 1 contact form is dependency-free. |
| Data fetching | TanStack Query (planned) | Deferred until the API serves content (Phase 2+). |

## 4. Backend Structure

`backend/src/` keeps route → controller → service separation:

```
src/
  config/        env parsing, logger
  controllers/   thin HTTP adapters (parse request, call service, respond)
  routes/        express routers — NO business logic
  services/      business logic
  repositories/  (Phase 2+) data access via Prisma
  validators/    (Phase 2+) request validation
  middleware/    security, errors, 404
  utils/         AppError, asyncHandler
  app.ts         createApp() — wires everything (testable)
  server.ts      HTTP entry point
```

- Every response uses the shared `ApiResponse` envelope
  (`{ success, message, data?, errors? }`).
- Centralized error handling maps `AppError` to status codes; unexpected
  errors return a safe generic message and are logged.
- `GET /api/health` returns the Phase 1 contract:
  `{ success: true, message: "PRPS API is running", data: {...} }`.

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
  config/          site + env config
  lib/             cn, date helpers
  types/           public site content types
  styles/          Tailwind entry + brand theme
```

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
- No offline data synchronization in Phase 1 (documented in `development.md`).

## 7. Security Baseline (Phase 1)

- `helmet` security headers; `x-powered-by` disabled.
- CORS restricted to configured `CLIENT_URL` origin(s).
- Basic global rate limiting.
- JSON body size limits.
- Centralized error handling — no stack traces leaked to clients.
- Secrets only exist in the backend (`.env`, git-ignored); the frontend only
  ever receives `VITE_API_URL`.

Later phases add auth, RBAC, per-route authorization, validation, audit logs,
and backend-enforced permissions.

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
