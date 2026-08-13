# Prime Royal Preparatory School — School Management System

**P.R.P.S.** · **Motto:** Empowerment Through Education

A modern School Management System and Progressive Web Application built for the
school community: owner/proprietress, headteacher, assistant headteacher,
accountant, teaching and non-teaching staff, class and subject teachers,
pupils, and parents/guardians.

> **Current phase: 1 — Foundation + Public Website (10% of project scope).**

## Repository Layout

```
frontend/   React 19 + TypeScript + Vite + Tailwind CSS v4 public website & PWA
backend/    Node.js + Express 4 + TypeScript REST API
database/   PostgreSQL data layer (Prisma ORM, migrations, seed)
shared/     Shared types, enums, constants and API contracts (@prps/shared)
docs/       architecture, design-system, database, development
scripts/    Small automation (env bootstrap)
```

## Quick Start

```bash
npm install
npm run setup          # create backend/.env and frontend/.env from examples
npm run build:shared
npm run dev            # frontend on :5173, backend on :4000
```

Check the API: http://localhost:4000/api/health

See `docs/development.md` for the full guide and `docs/architecture.md` for
the system design.

## What Phase 1 Includes

- Complete responsive public website: Home (hero, features, statistics,
  academic programmes, admission process, Parent Portal promo, news, gallery,
  contact), About, Academics, Admissions, School Life, Gallery, News, Contact.
- PRPS design system (cream / white / deep royal blue / magenta) applied
  consistently, with the brand palette in `frontend/src/styles/index.css`.
- A cohesive SVG illustration system (pupils always in **solid cream**
  uniforms) so the site needs no external photo dependencies.
- Express backend with `GET /api/health`, security headers, CORS, rate
  limiting, structured logging, 404 + centralized error handling, and API
  tests.
- PostgreSQL foundation via Prisma: `SchoolProfile` schema, committed
  migration, seed script, workspace commands.
- Shared contracts package (`@prps/shared`) used by frontend and backend.
- PWA foundation: manifest, theme color, generated icons (192/512 + maskable),
  service worker precache, installability.
- Monorepo workspace scripts: `dev`, `build`, `typecheck`, `lint`, `test`,
  `check`, `db:*`, `setup`.

## Phase Roadmap

| Phase | Focus | Scope |
| --- | --- | --- |
| 1 ✅ | Foundation + Public Website | 10% |
| 2 | Owner Portal + Authentication | 15% |
| 3 | Headteacher + Administration | 15% |
| 4 | Pupil Management | 15% |
| 5 | Accountant + Fees | 15% |
| 6 | Teachers + Academics (lesson plans, SBA) | 15% |
| 7 | Reports + Parent Portal | 10% |
| 8 | Attendance + GPS | 5% |
| 9 | Notifications + Advanced Features | 5% |

Each phase ends with a completion report and **stops** — the next phase starts
only on explicit approval.

## Security Notes

- Secrets live only in git-ignored `.env` files; the frontend only ever gets
  `VITE_API_URL`.
- Phase 1 baseline: helmet, CORS, rate limiting, no error leakage.
- From Phase 2: auth, RBAC/permission-based access control enforced by the
  backend, validation, audit logs.

## Placeholders & Assumptions

No official logo, photos, or school contact details were available, so the
project uses clearly-labelled placeholders:

- Branded PRPS emblem (`frontend/public/logo.svg`) — swap in the official logo.
- Generated SVG scenes for all imagery — swap in real photographs.
- Contact details marked "to be confirmed" (`frontend/src/config/site.ts`).
- Demo statistics/news as provided by the brief; fee amounts are never
  invented.
