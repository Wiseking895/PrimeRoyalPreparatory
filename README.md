# Prime Royal Preparatory School — School Management System

**P.R.P.S.** · **Motto:** Empowerment Through Education

A modern School Management System and Progressive Web Application built for the
school community: owner/proprietress, headteacher, assistant headteacher,
accountant, teaching and non-teaching staff, class and subject teachers,
pupils, and parents/guardians.

> **Current phase: 2 — Owner Portal + Authentication (15% of project scope).**

## Repository Layout

```
frontend/   React 19 + TypeScript + Vite + Tailwind CSS v4 public website & PWA
backend/    Node.js + Express 4 + TypeScript + Prisma + PostgreSQL REST API
docs/       Repo-wide architecture + development guides (repo root)
```

The frontend and backend are **independent applications**. They communicate only
through HTTP: the frontend talks to the backend via `VITE_API_URL` and never
imports backend code, and Prisma/PostgreSQL live entirely inside `backend/`.

Each application is fully self-contained (its own `package.json`, `tsconfig.json`,
ESLint config, build config, `.env.example`, scripts and app-specific docs):

```
frontend/  src/ public/ docs/ scripts/ package.json tsconfig.json vite.config.ts
           vitest.config.ts vitest.setup.ts eslint.config.mjs .env.example
backend/   src/ prisma/ docs/ scripts/ package.json tsconfig.json tsup.config.ts
           vitest.config.ts eslint.config.mjs .env.example
```

Per-app documentation:
- `frontend/docs/design-system.md` — brand, typography, components, accessibility.
- `backend/docs/database.md` — Prisma, migrations, seed, database workflows.

## Quick Start

```bash
npm install
npm run setup          # create backend/.env and frontend/.env from examples
npm run dev            # frontend on :5173, backend on :4000
```

Check the API: http://localhost:4000/api/health

See `docs/development.md` for the full guide and `docs/architecture.md` for
the system design.

## Deployment

- **Frontend → Vercel:** `vercel.json` at the repo root points Vercel at the
  `frontend/` app (`root: "frontend"`); Vercel installs from the single root
  npm workspace lockfile for reproducible builds. Set `VITE_API_URL` to your
  production backend URL (e.g. `https://api.your-school.example`) in the
  Vercel project settings. The frontend build needs **no** PostgreSQL and
  **no** `DATABASE_URL`.
- **Backend → any Node-compatible host:** build with `npm run build -w @prps/backend`,
  apply migrations with `npm run db:deploy`, then start with `npm start`
  (from `backend/`). Configure `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL` and
  `PORT` in the host's environment.
- **Database → PostgreSQL:** Prisma schema, migrations and seed live under
  `backend/prisma/`. The backend owns all database access.

## What the Project Includes

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
- Owner portal + authentication (Phase 2): initial owner setup, JWT auth,
  RBAC (roles/permissions enforced by the backend), owner → headteacher
  administration, staff management, and an audit log.
- PostgreSQL data layer via Prisma inside `backend/`: `SchoolProfile`, users,
  roles, permissions, staff profiles and audit logs, with committed migrations
  and a seed script.
- PWA foundation: manifest, theme color, generated icons (192/512 + maskable),
  service worker precache, installability.
- Root workspace scripts: `dev`, `build`, `typecheck`, `lint`, `test`,
  `check`, `db:*`, `setup`.

## Phase Roadmap

| Phase | Focus | Scope |
| --- | --- | --- |
| 1 ✅ | Foundation + Public Website | 10% |
| 2 ✅ | Owner Portal + Authentication | 15% |
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
- Phase 2: auth, RBAC/permission-based access control enforced by the
  backend, validation, audit logs.

## Placeholders & Assumptions

No official logo, photos, or school contact details were available, so the
project uses clearly-labelled placeholders:

- Branded PRPS emblem (`frontend/public/logo.svg`) — swap in the official logo.
- Generated SVG scenes for all imagery — swap in real photographs.
- Contact details marked "to be confirmed" (`frontend/src/config/site.ts`).
- Demo statistics/news as provided by the brief; fee amounts are never
  invented.