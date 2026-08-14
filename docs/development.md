# PRPS — Development Guide

**Phase:** 2

## 1. Prerequisites

- Node.js ≥ 20 (tested on Node 24)
- npm ≥ 10 (workspaces)
- PostgreSQL (only required for database commands and backend runtime)

## 2. Install & First Run

```bash
# from the repository root
npm install
npm run setup          # copies backend/.env.example and frontend/.env.example → .env
npm run dev            # backend (http://localhost:4000) + frontend (http://localhost:5173)
```

Open http://localhost:5173 for the public website and
http://localhost:4000/api/health for the API.

## 3. Workspace Scripts (run from root)

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs backend + frontend concurrently (each in watch mode). |
| `npm run dev:backend` / `npm run dev:frontend` | Run a single app in watch mode. |
| `npm run build` | Builds backend → frontend. |
| `npm run typecheck` | Type-checks both workspaces. |
| `npm run lint` | ESLint in each workspace (frontend + backend). |
| `npm test` | Vitest suites (backend API + frontend units). |
| `npm run check` | Full gate: prisma generate → typecheck → lint → test → build. |
| `npm run db:*` | `generate`, `migrate`, `deploy`, `seed`, `studio` (see `backend/docs/database.md`). |
| `npm run setup` | Bootstrap `.env` files from each app's `.env.example`. |

The frontend and backend are also **independently buildable**:

```bash
cd frontend && npm run build     # needs no PostgreSQL and no DATABASE_URL
cd backend  && npm run build     # needs prisma generate (and DB only at runtime)
```

### Frontend-only

```bash
npm run generate:pwa-assets -w @prps/frontend   # regenerate PWA icons from public/logo.svg
npm run preview -w @prps/frontend               # preview the production build
```

## 4. Environment Variables

Committed examples, never secrets:

- `backend/.env` — `NODE_ENV`, `PORT`, `CLIENT_URL`, `DATABASE_URL`,
  `JWT_SECRET`.
- `frontend/.env` — `VITE_API_URL` only. **Never** put `DATABASE_URL` or any
  secret in a `VITE_` variable (it is embedded in the browser bundle).

For production the frontend must be given the deployed backend URL:

```bash
# frontend/.env (or Vercel project settings)
VITE_API_URL=https://your-production-backend.example
```

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
- **API endpoint:** follow route → controller → service in the backend; keep
  the `ApiResponse` envelope. Update the frontend client in `lib/api.ts` and,
  if a role/permission key changes, sync `backend/src/rbac/catalog.ts` and the
  frontend mirror in `frontend/src/auth/roles.ts`.

## 6. Quality Gates

Every phase ends with:

1. `npm run check` (or its individual steps).
2. Manual smoke test of responsive widths (320 / 375 / 390 / 430 / 768 / 1024 /
   1280 / 1440 / 1920 px).
3. Browser console free of obvious errors.
4. A completion report (see README phase checklist).

## 7. PWA Notes

- Service worker registers in production builds and in `vite preview`, not in
  plain dev mode.
- Offline behavior currently covers static site assets only. **No** offline
  data sync — that is a deliberate later-phase decision.
- To test installability: `npm run build -w @prps/frontend`, then
  `npm run preview -w @prps/frontend`, open the preview URL in Chrome and use
  the install icon in the address bar.

## 8. Testing

- Backend: `vitest` + `supertest` (`backend/src/*.test.ts`). Health endpoint,
  404, security headers, RBAC catalog/guards.
- Frontend: `vitest` + `@testing-library/react` + `jsdom`
  (`frontend/src/**/*.test.{ts,tsx}`). Utility and component tests.

Financial, authorization and parent-data security tests become mandatory in
their respective phases.

## 9. Conventions

- Strict TypeScript everywhere; no `any`.
- No business logic in route files.
- No shared package between frontend and backend — the two apps communicate
  only via HTTP. Constants that both sides need are mirrored locally (backend
  authoritative; frontend keeps display keys in sync).
- No hardcoded fees, permissions, user IDs, or contact details (placeholders
  documented in `frontend/src/config/site.ts`).
- No new dependency without a real reason; prefer the stack in
  `docs/architecture.md`.

## 10. Known Phase 2 Gaps

- Contact form and newsletter are frontend-only demos (not wired to an API).
- Privacy Policy / Terms of Use are placeholder links.
- Content is local demo data (API-ready via the content service).