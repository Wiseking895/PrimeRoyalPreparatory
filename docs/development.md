# PRPS — Development Guide

**Phase:** 1

## 1. Prerequisites

- Node.js ≥ 20 (tested on Node 24)
- npm ≥ 10 (workspaces)
- PostgreSQL (only required for database commands and later phases)

## 2. Install & First Run

```bash
# from the repository root
npm install
npm run setup          # copies backend/.env.example and frontend/.env.example → .env
npm run build:shared   # build the shared contracts package first
npm run dev            # backend (http://localhost:4000) + frontend (http://localhost:5173)
```

Open http://localhost:5173 for the public website and
http://localhost:4000/api/health for the API.

## 3. Workspace Scripts (run from root)

| Command | What it does |
| --- | --- |
| `npm run dev` | Builds `@prps/shared`, then runs backend + frontend concurrently. |
| `npm run dev:backend` / `npm run dev:frontend` | Run a single app in watch mode. |
| `npm run build` | Builds shared → backend → frontend. |
| `npm run typecheck` | Type-checks all workspaces. |
| `npm run lint` | ESLint (flat config) across the repo. |
| `npm test` | Vitest suites (backend API + frontend units). |
| `npm run check` | Full gate: build shared → prisma generate → typecheck → lint → test → build. |
| `npm run db:*` | `generate`, `migrate`, `deploy`, `seed`, `studio` (see `docs/database.md`). |
| `npm run setup` | Bootstrap `.env` files from examples. |

### Frontend-only

```bash
npm run generate:pwa-assets -w @prps/frontend   # regenerate PWA icons from public/logo.svg
npm run preview -w @prps/frontend               # preview the production build
```

## 4. Environment Variables

Committed examples, never secrets:

- `backend/.env` — `NODE_ENV`, `PORT`, `CLIENT_URL`, `DATABASE_URL`, `JWT_SECRET` (Phase 2+).
- `frontend/.env` — `VITE_API_URL` only. **Never** put `DATABASE_URL` or any
  secret in a `VITE_` variable (it is embedded in the browser bundle).

## 5. Adding Content / Code

- **Public site content:** edit typed records in `frontend/src/data/*` and (if
  adding a getter) `services/site-content.ts`. Do not import `data/` directly
  from UI components — always go through the service.
- **New scene:** add a component in
  `components/illustrations/scenes/`, register it in `Scene.tsx`, and (for
  icons) extend the map in `components/ui/DynamicIcon.tsx`.
- **New brand token:** add to the `@theme` block in
  `frontend/src/styles/index.css` and mirror it in `illustration-colors.ts` if
  used by art.
- **API endpoint:** follow route → controller → service; update `shared` types
  and constants; keep the `ApiResponse` envelope.

## 6. Quality Gates

Every phase ends with:

1. `npm run check` (or its individual steps).
2. Manual smoke test of responsive widths (320 / 375 / 390 / 430 / 768 / 1024 /
   1280 / 1440 / 1920 px).
3. Browser console free of obvious errors.
4. A completion report (see README phase checklist).

## 7. PWA Notes (Phase 1)

- Service worker registers in production builds and in `vite preview`, not in
  plain dev mode.
- Offline behavior currently covers static site assets only. **No** offline
  data sync — that is a deliberate later-phase decision.
- To test installability: `npm run build -w @prps/frontend`, then
  `npm run preview -w @prps/frontend`, open the preview URL in Chrome and use
  the install icon in the address bar.

## 8. Testing

- Backend: `vitest` + `supertest` (`backend/src/*.test.ts`). Health endpoint,
  404, security headers.
- Frontend: `vitest` + `@testing-library/react` + `jsdom`
  (`frontend/src/**/*.test.{ts,tsx}`). Utility and component tests.

Financial, authorization and parent-data security tests become mandatory in
their respective phases.

## 9. Conventions

- Strict TypeScript everywhere; no `any`.
- No business logic in route files.
- No duplicated types — import from `@prps/shared`.
- No hardcoded fees, permissions, user IDs, or contact details (placeholders
  documented in `src/config/site.ts`).
- No new dependency without a real reason; prefer the stack in
  `docs/architecture.md`.

## 10. Known Phase 1 Gaps

- Contact form and newsletter are frontend-only demos (not wired to an API).
- Privacy Policy / Terms of Use are placeholder links.
- Content is local demo data (API-ready via the content service).
